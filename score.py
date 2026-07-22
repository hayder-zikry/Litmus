"""score.py -- Stage 5: turn the verdicts into a concern score. Arithmetic only (brief section 7).

    compute_score(claims, verdicts) -> models.Score

The number must be reproducible and defensible on stage: refuted counts 1, disputed counts 0.5,
denominator is the number of checkable claims. Every track computes it the same way or the demo
contradicts itself.
"""
import models


def compute_score(claims: list[models.Claim], verdicts: list[models.ClaimVerdict]) -> models.Score:
    checkable_total = sum(1 for c in claims if c.checkable)

    counts = {"refuted": 0, "disputed": 0, "unverified": 0, "supported": 0, "not_checkable": 0}
    for v in verdicts:
        if v.verdict in counts:
            counts[v.verdict] += 1

    if checkable_total == 0:
        percentage = None  # UI shows "No checkable claims found", never 0%
    else:
        numerator = counts["refuted"] + 0.5 * counts["disputed"]
        percentage = round(numerator / checkable_total * 100)

    # When most of the video can't be verified, the panel should look weak -- that's honest.
    limited_evidence = checkable_total > 0 and counts["unverified"] > checkable_total / 2

    return models.Score(
        percentage=percentage,
        refuted=counts["refuted"],
        disputed=counts["disputed"],
        unverified=counts["unverified"],
        supported=counts["supported"],
        not_checkable=counts["not_checkable"],
        checkable_total=checkable_total,
        limited_evidence=limited_evidence,
    )


if __name__ == "__main__":
    import json

    data = json.load(open("example_response.json"))
    result = models.AnalysisResult(**data)
    score = compute_score(result.extraction.claims, result.verdicts)

    print(score.model_dump_json(indent=2))

    # Hand-check against the brief's formula.
    if score.checkable_total:
        expected = round((score.refuted + 0.5 * score.disputed) / score.checkable_total * 100)
        assert score.percentage == expected, (score.percentage, expected)
        print(f"\nOK  {score.percentage}% = ({score.refuted} refuted + 0.5x{score.disputed} disputed) "
              f"/ {score.checkable_total} checkable")
    else:
        print("\nOK  no checkable claims -> percentage is None (UI shows 'No checkable claims found')")
    print("PASS - score arithmetic matches brief section 7.")
