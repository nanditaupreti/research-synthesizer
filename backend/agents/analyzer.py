import json
from typing import List, Dict, Any
import openai
from config import OPENAI_API_KEY, OPENAI_MODEL

client = openai.OpenAI(api_key=OPENAI_API_KEY)


def analyze_finding(topic: str, finding: Dict) -> Dict[str, Any]:
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": """You are an expert research analyst. Analyze research findings and extract structured insights.
Return a JSON object with these exact keys:
- key_facts: list of 3-5 specific factual claims
- themes: list of 2-3 main themes
- entities: list of important people, organizations, or concepts mentioned
- reliability_score: float 0-1 (confidence in source quality)
- insights: 2-3 novel analytical insights not explicitly stated in the text
- gaps: any missing information that would strengthen the analysis"""
            },
            {
                "role": "user",
                "content": f"Research topic: {topic}\nQuery: {finding['query']}\n\nContent to analyze:\n{finding['content'][:3000]}\n\nReturn valid JSON only."
            }
        ],
        temperature=0.2,
        response_format={"type": "json_object"}
    )

    try:
        analysis = json.loads(response.choices[0].message.content)
    except Exception:
        analysis = {
            "key_facts": ["Analysis parsing error"],
            "themes": ["General"],
            "entities": [],
            "reliability_score": 0.5,
            "insights": [],
            "gaps": ["Full analysis unavailable"]
        }

    return {
        "query": finding["query"],
        "sources": finding.get("sources", []),
        "raw_content_length": len(finding["content"]),
        **analysis
    }


def synthesize_analyses(topic: str, analyses: List[Dict]) -> Dict[str, Any]:
    analyses_text = json.dumps(analyses, indent=2)[:6000]
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": """You are a senior research analyst. Cross-analyze multiple research findings and produce a meta-analysis.
Return JSON with:
- cross_cutting_themes: themes appearing across multiple sources
- contradictions: any conflicting information found
- confidence_level: overall confidence in findings (high/medium/low)
- key_takeaways: list of 5 most important insights overall
- recommended_focus_areas: areas that need more research
- overall_reliability: float 0-1"""
            },
            {
                "role": "user",
                "content": f"Topic: {topic}\n\nIndividual analyses:\n{analyses_text}\n\nProvide cross-analysis JSON."
            }
        ],
        temperature=0.2,
        response_format={"type": "json_object"}
    )

    try:
        return json.loads(response.choices[0].message.content)
    except Exception:
        return {
            "cross_cutting_themes": [],
            "contradictions": [],
            "confidence_level": "medium",
            "key_takeaways": [],
            "recommended_focus_areas": [],
            "overall_reliability": 0.6
        }


def run_analyzer(topic: str, findings: List[Dict]) -> Dict[str, Any]:
    individual_analyses = []
    for finding in findings:
        analysis = analyze_finding(topic, finding)
        individual_analyses.append(analysis)

    meta_analysis = synthesize_analyses(topic, individual_analyses)

    all_themes = []
    all_facts = []
    all_entities = []
    avg_reliability = 0.0

    for a in individual_analyses:
        all_themes.extend(a.get("themes", []))
        all_facts.extend(a.get("key_facts", []))
        all_entities.extend(a.get("entities", []))
        avg_reliability += a.get("reliability_score", 0.5)

    if individual_analyses:
        avg_reliability /= len(individual_analyses)

    return {
        "individual_analyses": individual_analyses,
        "meta_analysis": meta_analysis,
        "aggregate": {
            "unique_themes": list(set(all_themes)),
            "total_facts": len(all_facts),
            "unique_entities": list(set(all_entities)),
            "average_reliability": round(avg_reliability, 2)
        },
        "total_analyzed": len(individual_analyses)
    }
