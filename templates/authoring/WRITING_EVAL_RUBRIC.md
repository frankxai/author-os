# Writing Eval Rubric

Score important writing on a 100 point scale.

| Dimension | Points | Test |
|---|---:|---|
| Truth and evidence | 15 | Are claims sourced, current, qualified, and not overstated? |
| Strategic clarity | 12 | Is the audience, point, stake, and next action obvious? |
| Intellectual depth | 12 | Does it show synthesis and judgment rather than generic ideas? |
| Human voice | 10 | Does it sound alive, specific, and intentional? |
| Emotional resonance | 10 | Does it create felt meaning without sentimentality? |
| Structure and flow | 10 | Does every section move the argument or story forward? |
| Style and grammar | 8 | Is the prose clean, rhythmic, and free of obvious AI tics? |
| Brand fit | 8 | Does it match the relevant brand world and voice constraints? |
| Community and trust | 7 | Does it invite participation and growth without pressure? |
| Ethical influence | 5 | Are persuasion techniques honest and reader-respecting? |
| Agent readability | 3 | Can future agents parse intent, provenance, constraints, and state? |

## Thresholds

- `90+`: premium ready.
- `82-89`: good but needs one focused pass.
- `70-81`: useful draft, not publish-ready.
- `<70`: restart or rewrite from structure.

## Automatic Failure Conditions

- Unsupported legal, health, financial, technical, or performance claims.
- Fabricated sources, testimonials, metrics, or social proof.
- Locked state changed without approval.
- Brand voice flattened into generic assistant prose.
- Public promise stronger than available proof.
- Manipulative urgency, fear, shame, or false scarcity.

## Review Output

```json
{
  "score": 0,
  "scores": {
    "truthAndEvidence": 0,
    "strategicClarity": 0,
    "intellectualDepth": 0,
    "humanVoice": 0,
    "emotionalResonance": 0,
    "structureAndFlow": 0,
    "styleAndGrammar": 0,
    "brandFit": 0,
    "communityAndTrust": 0,
    "ethicalInfluence": 0,
    "agentReadability": 0
  },
  "shipDecision": "ship|focused-pass|draft|restart",
  "topStrengths": [],
  "topRisks": [],
  "requiredFixes": [],
  "bestRewriteOpportunity": ""
}
```
