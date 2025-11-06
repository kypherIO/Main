"""
xAI Integration Service for Opportunity Analysis
"""
from openai import OpenAI
from core.config import settings
from loguru import logger
import json

class AIService:
    """Service for AI-powered analysis using xAI Grok"""

    def __init__(self):
        self.client = OpenAI(
            api_key=settings.XAI_API_KEY,
            base_url=settings.XAI_BASE_URL
        )
        self.model = settings.XAI_MODEL

    async def analyze_opportunity(self, data_type: str, item) -> dict:
        """
        Analyze a permit, bid, or property for opportunity potential

        Args:
            data_type: Type of data (permit, bid, property)
            item: Database model instance

        Returns:
            Dictionary with analysis results
        """
        try:
            prompt = self._build_analysis_prompt(data_type, item)

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert business analyst helping general contractors identify remodeling opportunities. Analyze the provided data and give actionable insights."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=1000
            )

            analysis_text = response.choices[0].message.content

            # Extract structured data if possible
            score = self._extract_score(analysis_text)
            reasons = self._extract_reasons(analysis_text)

            return {
                "score": score,
                "analysis": analysis_text,
                "reasons": reasons,
                "model": self.model
            }

        except Exception as e:
            logger.error(f"AI analysis failed: {str(e)}")
            return {
                "score": 0,
                "analysis": f"Analysis failed: {str(e)}",
                "reasons": [],
                "error": str(e)
            }

    def _build_analysis_prompt(self, data_type: str, item) -> str:
        """Build analysis prompt based on data type"""

        if data_type == "permit":
            return f"""
Analyze this construction permit for remodeling business opportunities:

Permit Number: {item.permit_number}
Address: {item.address}, {item.city}, {item.state}
Work Type: {item.work_type}
Description: {item.description}
Project Value: ${item.project_value:,.2f if item.project_value else 0}
Issue Date: {item.issue_date}
Owner: {item.owner_name}
Current Contractor: {item.contractor_name or 'None listed'}

Please provide:
1. Opportunity Score (0-100): How valuable is this lead for a general contractor?
2. Key Reasons: Why this is or isn't a good opportunity
3. Recommended Action: What should a contractor do?
4. Timing: When to reach out?

Format your response with clear sections.
"""

        elif data_type == "bid":
            return f"""
Analyze this municipal bid for a general contractor:

Bid Number: {item.bid_number}
Title: {item.title}
Category: {item.category}
Description: {item.description}
Estimated Value: ${item.estimated_value:,.2f if item.estimated_value else 0}
Location: {item.city}, {item.state}
Due Date: {item.due_date}
Agency: {item.agency_name}
Requirements: {item.requirements}
Bonding Required: {item.bonding_required}

Please provide:
1. Opportunity Score (0-100): How suitable is this bid?
2. Key Considerations: Important factors to consider
3. Competitive Assessment: Likely competition level
4. Recommendation: Should a small-medium contractor pursue this?

Format your response with clear sections.
"""

        else:  # property
            return f"""
Analyze this property for potential remodeling opportunities:

Address: {item.address}, {item.city}, {item.state}
Year Built: {item.year_built}
Building Age: {item.building_age} years
Property Type: {item.property_type}
Square Footage: {item.square_footage:,.0f if item.square_footage else 0} sq ft
Assessed Value: ${item.assessed_value:,.2f if item.assessed_value else 0}
Owner: {item.owner_name}
HOA: {item.hoa_name if item.has_hoa else 'None'}
Recent Permits: {item.recent_permits}
Last Permit: {item.last_permit_date}

Please provide:
1. Opportunity Score (0-100): Likelihood of needing remodeling work
2. Key Indicators: What suggests remodeling potential?
3. Predicted Work Needed: What type of work might be needed?
4. Outreach Strategy: How to approach this property owner?

Format your response with clear sections.
"""

    def _extract_score(self, analysis: str) -> float:
        """Extract numerical score from analysis text"""
        import re

        # Look for patterns like "Score: 75" or "75/100"
        patterns = [
            r'Score[:\s]+(\d+)',
            r'(\d+)/100',
            r'(\d+)%'
        ]

        for pattern in patterns:
            match = re.search(pattern, analysis, re.IGNORECASE)
            if match:
                score = float(match.group(1))
                return min(max(score, 0), 100)  # Clamp between 0-100

        return 50.0  # Default neutral score

    def _extract_reasons(self, analysis: str) -> list:
        """Extract key reasons from analysis text"""
        reasons = []

        # Simple extraction - look for numbered lists or bullet points
        lines = analysis.split('\n')
        for line in lines:
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('-') or line.startswith('•')):
                # Remove leading numbers, bullets, etc.
                clean_line = re.sub(r'^[\d\.\-\•\*\s]+', '', line)
                if len(clean_line) > 10:  # Meaningful content
                    reasons.append(clean_line)

        return reasons[:5]  # Return top 5 reasons

    async def batch_score_items(self, data_type: str, items: list) -> dict:
        """
        Score multiple items in a batch for efficiency

        Args:
            data_type: Type of data
            items: List of items to score

        Returns:
            Dictionary mapping item IDs to scores
        """
        results = {}

        for item in items:
            try:
                analysis = await self.analyze_opportunity(data_type, item)
                results[item.id] = {
                    'score': analysis['score'],
                    'reasons': analysis.get('reasons', [])
                }
            except Exception as e:
                logger.error(f"Failed to score {data_type} {item.id}: {str(e)}")
                results[item.id] = {'score': 0, 'reasons': []}

        return results

    async def generate_market_insights(self, db_session) -> str:
        """
        Generate overall market insights from all scraped data

        Args:
            db_session: Database session

        Returns:
            Market analysis text
        """
        from sqlalchemy import func
        from models import Permit, Bid, Property
        from datetime import datetime, timedelta

        # Gather statistics
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)

        stats = {
            'recent_permits': db_session.query(func.count(Permit.id)).filter(
                Permit.issue_date >= thirty_days_ago
            ).scalar(),
            'active_bids': db_session.query(func.count(Bid.id)).filter(
                Bid.status == 'Open'
            ).scalar(),
            'avg_permit_value': db_session.query(func.avg(Permit.project_value)).filter(
                Permit.project_value > 0,
                Permit.issue_date >= thirty_days_ago
            ).scalar(),
            'properties_old': db_session.query(func.count(Property.id)).filter(
                Property.building_age > 30
            ).scalar()
        }

        prompt = f"""
Based on this data from the Bowling Green, KY area (last 30 days):

- Recent Permits: {stats['recent_permits']}
- Active Municipal Bids: {stats['active_bids']}
- Average Permit Value: ${stats['avg_permit_value']:,.2f if stats['avg_permit_value'] else 0}
- Properties Over 30 Years Old: {stats['properties_old']}

Provide a brief market analysis for a general contractor. Include:
1. Market conditions and trends
2. Best opportunities currently
3. Strategic recommendations

Keep it concise (200-300 words).
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a construction industry analyst providing market insights."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=500
            )

            return response.choices[0].message.content

        except Exception as e:
            logger.error(f"Market insights generation failed: {str(e)}")
            return f"Unable to generate insights: {str(e)}"
