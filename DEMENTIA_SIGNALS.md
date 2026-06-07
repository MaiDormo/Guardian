# DEMENTIA_SIGNALS.md

Clinical rationale for Guardian's signal design — why voice and location were chosen as
the two dementia-sensitive modalities, why baseline drift (not absolute thresholds) is
the right detection mechanism, and why this matters specifically for Hong Kong / Greater
Bay Area (GBA) families.

---

## 1. Why voice: it is a validated early biomarker for dementia

Cognitive decline measurably changes *how* a person speaks — often years before a formal
diagnosis. Three recent studies anchor Guardian's `voice_checkin` signal in real clinical
evidence rather than intuition:

- **Xue et al. (2021), Framingham Heart Study.** Analysed 1,264 neuropsychological-exam
  voice recordings from participants classified as normal cognition (NC), mild cognitive
  impairment (MCI), or dementia (DE). Two deep-learning models (LSTM and CNN) classified
  DE vs. healthy controls from voice alone: the CNN model reached a mean AUC of
  0.805 ± 0.027, balanced accuracy of 0.743 ± 0.015, and weighted F1 of 0.742 ± 0.033.
  This established that dementia status is recoverable from voice recordings with
  clinically meaningful accuracy — not a fringe signal.
  *(Xue C, Karjadi C, Paschalidis IC, Au R, Kolachalama VB. Alzheimers Res Ther.
  2021;13(1):146. doi:10.1186/s13195-021-00888-3)*

- **Rezaii et al. (2025), "Voiceprints of cognitive impairment."** SHAP analysis identified
  the specific acoustic/linguistic features that separate cognitively impaired speakers
  from healthy controls:
  - **Lower Language Informativeness Index (LII)** — impaired speakers convey less
    information per utterance during delayed recall.
  - **Longer inter-word pauses** — impaired speakers hesitate more between words.
  - **More sentences but fewer total words** (mean 36.3 vs. 54.2, t = −5.838, p < 0.001) —
    a compensatory strategy: breaking ideas into many short, simple sentences because
    constructing longer ones has become difficult (sentence count vs. sentence length:
    r = −0.66, p < 0.001).
  - **Shorter average word length.**

  These four features map directly onto the fields Guardian already captures in
  `voice_checkins` (`speech_rate_wpm`, `clarity_score`, `response_latency_s`,
  `confusion_markers`, `duration_s`) — Guardian is not inventing a new feature space, it
  is operationalising an evidence-backed one at a coarser, privacy-preserving granularity
  suitable for a passive home deployment.
  *(Rezaii N, Wong B, Aisen P, et al. npj Dement. 2025;1:35.
  doi:10.1038/s44400-025-00040-0)*

- **Amini et al. (2024), 6-year MCI→AD progression.** Using speech features plus basic
  demographics (age, sex, education) from 166 FHS participants (90 progressive MCI,
  76 stable MCI), their best model predicted progression from MCI to Alzheimer's disease
  within six years at 78.5% accuracy and 81.1% sensitivity. This is the strongest
  evidence in the literature that voice does not just *detect present* dementia — it
  **predicts future trajectory**, which is exactly the "preventative intercept" window
  Guardian is built to surface to the family before a crisis happens.
  *(Amini S, Hao B, Yang J, et al. Alzheimers Dement. 2024;20(8):5262-5270.
  doi:10.1002/alz.13886)*

**Bottom line:** voice is one of the few passive, non-intrusive signals with a
peer-reviewed, multi-year evidence base for both *detecting* dementia and *predicting its
progression*. That combination — passive, privacy-preserving, and predictive — is exactly
what a camera-free home monitoring product needs, and is why `voice_checkin` is one of
Guardian's eight signals.

---

## 2. Why location/GPS: dementia changes *where* people go before it changes *what* they say

Spatial disorientation and wandering are among the earliest and most consistently
reported behavioural changes in early-stage dementia, well documented in the gerontology
literature on "egocentric and allocentric navigation decline." Two properties make it a
strong complementary signal to voice:

- **It is observable continuously and passively**, unlike voice (which is sampled once a
  day via check-in). A drift in someone's daily footprint — visiting fewer places,
  taking longer or more erratic routes between the same two points, or leaving a
  well-established home radius at unusual hours — is detectable in near real-time from
  background location pings, with no active participation required from Ah-Ma.

- **It correlates with, but is not redundant with, voice.** Cognitive decline does not
  affect language and spatial cognition at the same rate or in the same order in every
  individual. By tracking both, Guardian reduces the chance that a single modality's
  noise (a bad-sleep day affecting speech, or a one-off detour affecting GPS) produces a
  false alarm — and increases confidence when *both* drift together (see §3,
  "multi-modal drift").

Guardian operationalises this via `location_update` / `wandering_detected` events
(`trajectory_density_score`, `baseline_cluster_match`, `minutes_outside_baseline_footprint`
— PRD §5.4) and DBSCAN clustering of the historical GPS trace to define what "normal"
looks like for *this* specific person, not a population average.

---

## 3. Why baseline drift — not fixed thresholds — is the right detection mechanism

Dementia presentation is highly individual: there is no universal "normal" speech rate or
travel radius that works across a population of elderly users. A fixed-threshold system
(e.g. "alert if speech rate < 100 wpm") would either miss naturally slow speakers or
flood faster speakers' families with false alarms — precisely the failure mode that
caused Hong Kong's Hospital Authority to withdraw CGM subsidies in July 2025: the
*signal* was present in the data, but undifferentiated alert volume overwhelmed the
people meant to act on it (PRD §1.1).

Guardian instead builds a **personal behavioural baseline**: each signal stream
(voice features, location clusters, presence/routine patterns) is embedded
(`nomic-embed-text`) and stored in `sqlite-vec`, then each new day's pattern is compared
against a rolling 14-day window via **cosine distance** (`backend/baseline.py`,
`backend/signals.py`). A signal only flips to amber/red when *that specific person's*
pattern deviates meaningfully from *their own* recent history — e.g. the demo's Day-7
trend scenario shows speech rate dropping from a personal baseline of 138 wpm to 89 wpm
(−35.5%, cosine distance 0.38), crossing the `ROUTINE_COSINE_AMBER` / `ROUTINE_COSINE_RED`
thresholds defined in `config.py`.

This is also why **multi-modal drift carries more diagnostic weight than any single
signal**: when voice, location, and meal-timing patterns all drift in the same window
(as in the Day-7 scenario, `agent.py`), the combined cosine deviation crossing 0.25
across modalities is a far stronger early-warning indicator than any one signal alone —
mirroring how clinicians triangulate across cognitive, behavioural, and functional
domains rather than relying on a single test. Critically, this drift is visible **weeks
before** an acute crisis (a fall, a missed dose escalating into a medical emergency) —
which is the entire premise of Guardian's "preventative intercept": surface the slow
drift early enough that the family can act *before* the emergency, not just be notified
*after* it.

A cold-start gate (`COLD_START_DAYS`) prevents the system from making baseline
comparisons before enough personal history exists to make them meaningful — avoiding the
exact "noisy alert" failure mode described above.

---

## 4. Hong Kong / GBA context: why this problem is acute *here*, *now*

- **Cross-border relocation is accelerating.** Hong Kong has 1.68 million residents over
  65. Rising housing costs are pushing growing numbers of elderly residents across the
  border into the Greater Bay Area (Shenzhen, Guangzhou), where the cost of living is
  lower — while their adult children remain in Hong Kong or abroad. This creates a
  *remote monitoring gap* that existing eldercare products do not address: different
  jurisdictions, different healthcare systems, different telecom/data regimes, and a
  family who — today — can see nothing and do nothing when something starts to go wrong
  (PRD §1.1, §2.1).

- **The CGM subsidy withdrawal is the cautionary precedent.** In July 2025, the Hong Kong
  Hospital Authority withdrew continuous glucose monitoring subsidies for elderly
  diabetic patients — not because the sensors failed, but because undifferentiated alert
  volume overwhelmed hospital staff who had no triage layer. Guardian is explicitly
  designed to be that missing **intelligence layer**: it does not just emit signals, it
  reasons over them on-device (Gemma 4 via Ollama) and only interrupts the family "when
  the situation genuinely demands it" (PRD §1.2, Quality Bar §1.3).

- **Privacy law and cultural norms make cameras a non-starter.** Cross-border data flows
  between Hong Kong/GBA jurisdictions face real legal friction, and — independent of
  law — a camera in an elderly parent's home is, for many HK families, simply
  unacceptable. mmWave radar (no image, no audio) plus a once-daily voice check-in (a
  phone call Ah-Ma already knows how to answer) and background GPS are the only
  modalities that deliver clinically meaningful signal *without* crossing that line.
  This is why Guardian's privacy claim ("zero bytes to cloud," on-device Gemma 4
  inference) is not a marketing footnote — it is the precondition that makes the whole
  product culturally and legally viable for this user base (PRD §1.4).

- **The persona is real for this team.** Guardian's primary persona — an adult child
  working in Hong Kong whose parent (early-stage dementia) lives alone across the border
  in Shenzhen, separated by no time difference but a very real distance — is not a
  hypothetical. It is the exact situation a growing number of HK families are entering
  as relocation accelerates, and it is the lens through which every signal-design
  decision in this document was made: *would this give that family member enough
  confidence not to call every morning, while still catching the days something is
  genuinely wrong?* (PRD §1.3, §2.1).

---

## 5. Summary: how the literature maps to the implementation

| Clinical evidence | Guardian implementation |
|---|---|
| Voice/speech reliably classifies dementia status (AUC up to 0.81) — Xue et al. 2021 | `voice_checkin` signal; `voice_checkins` table; `voice_checkin_completed` / `voice_distress_detected` events |
| LII, pause duration, sentence count/length, word length distinguish impaired speech — Rezaii et al. 2025 | `speech_rate_wpm`, `clarity_score`, `response_latency_s`, `confusion_markers`, `duration_s` fields (PRD §5.3) |
| Speech features predict MCI→AD progression up to 6 years out (78.5% accuracy) — Amini et al. 2024 | Rolling 14-day baseline + cosine-distance drift detection (`baseline.py`, `signals.py`) surfaces *trajectory*, not just snapshot state |
| Spatial/navigational decline is an early, passively observable dementia marker | `location_update` / `wandering_detected` events; DBSCAN baseline clustering; `trajectory_density_score` |
| Population thresholds produce undifferentiated alert floods (HK CGM precedent, July 2025) | Personal baseline + cosine comparison (not fixed thresholds); cold-start gate; on-device LLM triage before any family interruption |
| Multi-domain triangulation outperforms single-test diagnosis in clinical practice | Multi-modal drift detection — voice + location + routine cosine distances combined cross a joint threshold (0.25) for highest-confidence alerts |

---

## References

1. Xue C, Karjadi C, Paschalidis IC, Au R, Kolachalama VB. *Detection of dementia on
   voice recordings using deep learning: a Framingham Heart Study.* Alzheimers Res Ther.
   2021 Aug 31;13(1):146. doi:10.1186/s13195-021-00888-3. PMID: 34465384;
   PMCID: PMC8409004.
2. Rezaii N, Wong B, Aisen P, et al. *Voiceprints of cognitive impairment: analyzing
   digital voice for early detection of Alzheimer's and related dementias.* npj Dement.
   2025;1:35. doi:10.1038/s44400-025-00040-0.
3. Amini S, Hao B, Yang J, Karjadi C, Kolachalama VB, Au R, Paschalidis IC. *Prediction
   of Alzheimer's disease progression within 6 years using speech: A novel approach
   leveraging language models.* Alzheimers Dement. 2024 Aug;20(8):5262-5270.
   doi:10.1002/alz.13886. Epub 2024 Jun 25. PMID: 38924662; PMCID: PMC11350035.
