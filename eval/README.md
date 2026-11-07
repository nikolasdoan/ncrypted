# How accurate is the swipe model?

`evaluate_rf.py` measures the model the demo runs (same 20 features, a random
forest per person) on the public Touchalytics dataset: 41 people swiping on 5
Android phones (Frank et al., "Touchalytics", IEEE TIFS 2013).

For each owner, the other people on the same phone are split in two: one half
trains the model as "not the owner", the other half are strangers it never
sees until the test. Then the halves swap.

```bash
curl -O https://www.mariofrank.net/touchalytics/data.zip && unzip data.zip
pip install scikit-learn numpy
python3 eval/evaluate_rf.py data/data.csv results.json
```

Result (accuracy = 100% - equal error rate):

| Swipes scored together | 1 | 5 | 10 | 20 |
|---|---|---|---|---|
| Same day | 83% | 89% | 90% | 92% |
| 7-14 days later, profile not updated | 72% | 80% | 79% | 78% |

The previous scoring (cosine similarity to the average enrolled swipe) gave
strangers "LOW risk" as often as the owner - about 70% each - so it could not
tell people apart.

The demo's risk bands (65% / 35%) are a demo setting, not tuned thresholds.
