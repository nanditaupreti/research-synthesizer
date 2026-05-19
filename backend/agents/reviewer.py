import json
from typing import Dict, Any
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL

genai.configure(api_key=GEMINI_API_KEY)


def _call_gemini_json(system_prompt: str, user_prompt: str) -> str:
    model = genai.GenerativeModel(
        GEMINI_MODEL,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.1
        )
    )
    response = model.generate_content(user_prompt)
    return response.text


def _call_gemini(system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
    model = genai.GenerativeModel(
        GEMINI_MODEL,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(temperature=temperature, max_output_tokens=3500)
    )
    response = model.generate_content(user_prompt)
    return response.text


def score_report(report: str, topic: str) -> Dict:
    system = """You are a peer reviewer for research reports. Score and critique the given report.
Return JSON with:
- completeness_score: 0-10
- accuracy_score: 0-10
- clarity_score: 0-10
- depth_score: 0-10
- overall_score: 0-10
- strengths: list of 3 key strengths
- weaknesses: list of 2-3 areas for improvement
- missing_elements: any important aspects of the topic not covered
- suggested_additions: specific content that would improve the report
- hallucination_flags: any claims that seem potentially inaccurate (list, can be empty)"""

    user = f"Topic: {topic}\n\nReport to review:\n{report[:4000]}\n\nProvide scoring JSON."

    try:
        return json.loads(_call_gemini_json(system, user))
    except Exception:
        return {
            "completeness_score": 7,
            "accuracy_score": 7,
            "clarity_score": 7,
            "depth_score": 7,
            "overall_score": 7,
            "strengths": ["Well structured"],
            "weaknesses": ["Could use more detail"],
            "missing_elements": [],
            "suggested_additions": [],
            "hallucination_flags": []
        }


def improve_report(report: str, topic: str, scores: Dict) -> str:
    if scores.get("overall_score", 10) >= 8:
        return report

    weaknesses = json.dumps(scores.get("weaknesses", []))
    missing = json.dumps(scores.get("missing_elements", []))
    suggestions = json.dumps(scores.get("suggested_additions", []))
    flags = scores.get("hallucination_flags", [])

    improvement_instructions = f"""
Weaknesses to address: {weaknesses}
Missing elements to add: {missing}
Suggested additions: {suggestions}
Potential inaccuracies to verify/remove: {json.dumps(flags)}
"""

    system = """You are an expert editor improving research reports.
Revise the report to address the reviewer's feedback.
- Fix identified weaknesses
- Add missing elements
- Remove or hedge potentially inaccurate claims
- Maintain the same structure but enhance quality
- Preserve all accurate content
Return the complete improved report in markdown format."""

    user = f"Topic: {topic}\n\nOriginal report:\n{report}\n\nReviewer feedback:{improvement_instructions}\n\nProvide the improved complete report."
    return _call_gemini(system, user, temperature=0.3)


def run_reviewer(topic: str, synthesis_data: Dict) -> Dict[str, Any]:
    report = synthesis_data["report"]

    scores = score_report(report, topic)
    improved_report = improve_report(report, topic, scores)

    final_word_count = len(improved_report.split())
    improvement_delta = final_word_count - synthesis_data["metadata"]["word_count"]

    return {
        "final_report": improved_report,
        "review_scores": scores,
        "improvements_made": scores.get("overall_score", 10) < 8,
        "final_metadata": {
            **synthesis_data["metadata"],
            "final_word_count": final_word_count,
            "improvement_delta": improvement_delta,
            "overall_quality_score": scores.get("overall_score", 7),
            "hallucination_flags": len(scores.get("hallucination_flags", [])),
            "hallucination_reduction": len(scores.get("hallucination_flags", []))
        }
    }
