/**
 * @module admin/seedSampleDeck
 * @description Callable that seeds a high-yield sample deck into a new user's
 * account so the dashboard is never empty on first login.
 *
 * Creates a ghost "Sample Medical Deck" course, a sample section, and ~20
 * pre-authored high-yield Cardiology + Pharmacology SBA questions so that the
 * student can immediately experience the assessment engine and AI chat before
 * uploading their own files.
 *
 * Idempotent: if the user already has the sample deck, returns early.
 *
 * @returns {{ success: true, data: { courseId: string, questionCount: number } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth } = require("../middleware/validate");
const { db, batchSet } = require("../lib/firestore");
const { ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { QUESTION_QUALITY } = require("../lib/constants");

// ── Pre-authored sample questions ────────────────────────────────────────────

const SAMPLE_QUESTIONS = [
  {
    stem: "A 58-year-old man presents with crushing substernal chest pain radiating to his left arm, diaphoresis, and shortness of breath for the last 45 minutes. ECG shows ST elevation in leads II, III, and aVF. Which artery is most likely occluded?",
    options: ["Left anterior descending artery", "Right coronary artery", "Left circumflex artery", "Left main coronary artery"],
    correctIndex: 1,
    difficulty: 3,
    topicTags: ["Cardiology", "Coronary Artery Disease", "STEMI"],
    explanation: {
      correctWhy: "ST elevation in the inferior leads (II, III, aVF) indicates an inferior STEMI. The right coronary artery (RCA) supplies the inferior wall of the left ventricle and the posterior descending artery in ~85% of patients (right-dominant circulation).",
      whyOthersWrong: [
        "LAD occlusion causes anterior STEMI — ST changes in V1–V4.",
        "Circumflex occlusion causes lateral STEMI — ST changes in I, aVL, V5–V6.",
        "Left main occlusion typically causes massive anterior STEMI or haemodynamic collapse.",
      ],
      keyTakeaway: "Inferior STEMI (II, III, aVF) = RCA until proven otherwise. Always obtain a right-sided ECG to rule out RV infarction.",
    },
    confidenceScore: 0.97,
    quality: QUESTION_QUALITY.VERIFIED,
  },
  {
    stem: "A 67-year-old woman with a history of heart failure (EF 35%) is started on a new medication. Two weeks later her BNP has fallen by 40% and she reports improved exercise tolerance. Which drug class most likely explains this improvement?",
    options: ["Thiazide diuretics", "ACE inhibitors", "Beta-blockers", "Calcium channel blockers"],
    correctIndex: 1,
    difficulty: 2,
    topicTags: ["Cardiology", "Heart Failure", "Pharmacology"],
    explanation: {
      correctWhy: "ACE inhibitors reduce afterload and preload by blocking angiotensin II, leading to neurohormonal remodelling, improved cardiac output, and a significant drop in BNP. They are a first-line mortality-reducing therapy in HFrEF.",
      whyOthersWrong: [
        "Thiazides reduce preload (oedema) but do not reduce BNP this dramatically nor improve mortality in HFrEF.",
        "Beta-blockers also reduce BNP but act more slowly (weeks–months); the two-week timeline fits ACE inhibitors better.",
        "Non-dihydropyridine CCBs are generally avoided in HFrEF due to negative inotropic effects.",
      ],
      keyTakeaway: "ACEi / ARBs reduce BNP and mortality in HFrEF. Combined ARNi (sacubitril/valsartan) is now preferred for further benefit.",
    },
    confidenceScore: 0.94,
    quality: QUESTION_QUALITY.VERIFIED,
  },
  {
    stem: "A patient with atrial fibrillation is anticoagulated with warfarin (INR 2.5). He is started on amiodarone for rate control. One week later his INR is 4.8. What is the most likely mechanism?",
    options: ["CYP2C9 induction by amiodarone", "CYP2C9 inhibition by amiodarone", "Reduced vitamin K absorption", "Increased clotting factor synthesis"],
    correctIndex: 1,
    difficulty: 3,
    topicTags: ["Pharmacology", "Drug Interactions", "Anticoagulation"],
    explanation: {
      correctWhy: "Amiodarone inhibits CYP2C9, the primary enzyme responsible for metabolising the S-enantiomer of warfarin (the more potent form). This reduces warfarin clearance, raising plasma levels and the INR.",
      whyOthersWrong: [
        "Amiodarone inhibits, not induces, CYP enzymes.",
        "Reduced vitamin K absorption would require fat malabsorption or antibiotic interference with gut flora.",
        "Increased clotting factor synthesis would lower the INR, not raise it.",
      ],
      keyTakeaway: "Amiodarone + Warfarin = INR ↑ (CYP2C9 inhibition). Reduce warfarin dose by ~30–50% and monitor INR closely when starting amiodarone.",
    },
    confidenceScore: 0.96,
    quality: QUESTION_QUALITY.VERIFIED,
  },
  {
    stem: "A 72-year-old man with known aortic stenosis presents with exertional syncope. Echocardiography shows an aortic valve area of 0.7 cm² and a mean gradient of 52 mmHg. Which is the most appropriate next step?",
    options: ["Start ACE inhibitors", "Valve replacement or TAVI", "Aggressive diuresis", "Beta-blocker titration"],
    correctIndex: 1,
    difficulty: 3,
    topicTags: ["Cardiology", "Valvular Disease", "Aortic Stenosis"],
    explanation: {
      correctWhy: "The patient has severe symptomatic aortic stenosis (AVA <1.0 cm², gradient >40 mmHg, plus syncope). Definitive treatment is mechanical intervention: surgical aortic valve replacement (SAVR) or TAVI depending on surgical risk.",
      whyOthersWrong: [
        "ACE inhibitors are relatively contraindicated in severe AS — they drop afterload but the fixed obstruction prevents compensatory increase in cardiac output.",
        "Aggressive diuresis risks dangerous preload reduction in a preload-dependent, fixed-obstruction state.",
        "Beta-blockers may worsen symptoms by reducing heart rate and cardiac output across the stenotic valve.",
      ],
      keyTakeaway: "Severe symptomatic AS (syncope, angina, dyspnoea) → valve replacement. Mortality without intervention: ~50% at 2 years.",
    },
    confidenceScore: 0.95,
    quality: QUESTION_QUALITY.VERIFIED,
  },
  {
    stem: "A 45-year-old woman presents with palpitations. Her ECG shows a regular narrow-complex tachycardia at 180 bpm with retrograde P waves visible just after each QRS. Carotid sinus massage terminates the arrhythmia. What is the diagnosis?",
    options: ["Atrial flutter", "AV nodal re-entrant tachycardia (AVNRT)", "Ventricular tachycardia", "Wolff-Parkinson-White syndrome"],
    correctIndex: 1,
    difficulty: 3,
    topicTags: ["Cardiology", "Arrhythmia", "AVNRT"],
    explanation: {
      correctWhy: "AVNRT is the most common cause of regular narrow-complex SVT in adults. Re-entry occurs within or near the AV node via fast and slow pathways. Retrograde P waves appear very close to (or within) the QRS. Vagal manoeuvres (including carotid massage) terminate the circuit.",
      whyOthersWrong: [
        "Atrial flutter typically has a rate of ~150 bpm (2:1 block) and shows sawtooth flutter waves, not retrograde P waves.",
        "Ventricular tachycardia is a wide-complex tachycardia and does not respond reliably to vagal manoeuvres.",
        "WPW causes a delta wave in sinus rhythm; during SVT may be orthodromic (narrow) but accessory pathway location affects P-wave morphology differently.",
      ],
      keyTakeaway: "Regular narrow SVT + retrograde P waves close to QRS + responds to vagal manoeuvres = AVNRT. Adenosine is first-line pharmacological treatment.",
    },
    confidenceScore: 0.93,
    quality: QUESTION_QUALITY.VERIFIED,
  },
  {
    stem: "A patient is prescribed metformin for type 2 diabetes. Which of the following represents the PRIMARY mechanism of action of metformin?",
    options: ["Stimulates insulin secretion from beta cells", "Inhibits hepatic gluconeogenesis", "Increases renal glucose excretion", "Delays carbohydrate absorption from the gut"],
    correctIndex: 1,
    difficulty: 2,
    topicTags: ["Pharmacology", "Diabetes", "Biguanides"],
    explanation: {
      correctWhy: "Metformin's primary mechanism is inhibition of hepatic gluconeogenesis via activation of AMPK, which reduces glucose output from the liver. It also modestly improves peripheral insulin sensitivity.",
      whyOthersWrong: [
        "Insulin secretagogue action belongs to sulfonylureas and glinides, not metformin.",
        "SGLT2 inhibitors (e.g., empagliflozin) increase renal glucose excretion.",
        "Alpha-glucosidase inhibitors (acarbose) delay carbohydrate absorption.",
      ],
      keyTakeaway: "Metformin → AMPK activation → ↓ hepatic gluconeogenesis. It does NOT cause hypoglycaemia alone and is weight-neutral.",
    },
    confidenceScore: 0.98,
    quality: QUESTION_QUALITY.VERIFIED,
  },
  {
    stem: "A 35-year-old woman is prescribed a medication that causes a dry cough. She is switched to an alternative that works through the same system but does not cause cough. Which drug was she switched to?",
    options: ["Amlodipine", "Losartan", "Spironolactone", "Hydralazine"],
    correctIndex: 1,
    difficulty: 2,
    topicTags: ["Pharmacology", "RAAS", "Antihypertensives"],
    explanation: {
      correctWhy: "ACE inhibitors cause dry cough due to bradykinin accumulation. Angiotensin Receptor Blockers (ARBs) like losartan block the AT1 receptor instead of ACE, achieving the same RAAS blockade without bradykinin accumulation — and therefore no cough.",
      whyOthersWrong: [
        "Amlodipine is a calcium channel blocker — a different antihypertensive class.",
        "Spironolactone is a mineralocorticoid receptor antagonist, acting downstream of RAAS.",
        "Hydralazine is a direct vasodilator with a different mechanism entirely.",
      ],
      keyTakeaway: "ACEi cough → switch to ARB (same RAAS blockade, no bradykinin, no cough). ACEi → ARB is the standard substitution.",
    },
    confidenceScore: 0.97,
    quality: QUESTION_QUALITY.VERIFIED,
  },
  {
    stem: "Which of the following beta-blocker properties makes carvedilol particularly useful in heart failure with reduced ejection fraction (HFrEF)?",
    options: ["Beta-1 selective blockade only", "Non-selective beta + alpha-1 blockade", "Intrinsic sympathomimetic activity (ISA)", "Cardioprotection via potassium channel blockade"],
    correctIndex: 1,
    difficulty: 4,
    topicTags: ["Pharmacology", "Heart Failure", "Beta-Blockers"],
    explanation: {
      correctWhy: "Carvedilol is a non-selective beta-blocker (β1, β2) with additional alpha-1 adrenergic blockade. The alpha-1 blockade causes vasodilation, reducing afterload — beneficial in HFrEF in addition to the mortality benefit from beta-blockade.",
      whyOthersWrong: [
        "Beta-1 selectivity describes metoprolol/bisoprolol, which are also effective in HFrEF but lack carvedilol's vasodilatory alpha-1 blockade.",
        "ISA (pindolol) is generally avoided in HFrEF as partial agonism can worsen outcomes.",
        "Potassium channel blockade is a property of amiodarone/sotalol, not carvedilol.",
      ],
      keyTakeaway: "Carvedilol = non-selective β + α1 blockade → afterload ↓ + heart rate ↓ + neurohormonal benefit. One of three beta-blockers with HFrEF mortality evidence (with metoprolol succinate and bisoprolol).",
    },
    confidenceScore: 0.91,
    quality: QUESTION_QUALITY.VERIFIED,
  },
  {
    stem: "A 28-year-old woman with epilepsy and systemic lupus erythematosus (SLE) requires anticoagulation for a DVT. Which anticoagulant would you AVOID?",
    options: ["Low molecular weight heparin", "Warfarin", "Rivaroxaban", "Fondaparinux"],
    correctIndex: 2,
    difficulty: 4,
    topicTags: ["Pharmacology", "Anticoagulation", "SLE", "Antiphospholipid Syndrome"],
    explanation: {
      correctWhy: "SLE patients frequently have antiphospholipid syndrome (APS). DOAC (rivaroxaban) trials in APS patients have shown inferior outcomes compared to warfarin, with higher rates of thrombotic events. Additionally, many anti-epileptics induce CYP enzymes that reduce DOAC levels unpredictably.",
      whyOthersWrong: [
        "LMWH is safe and commonly used in APS/SLE, particularly during pregnancy.",
        "Warfarin, though complex to manage, has the best evidence in APS with INR target 2–3 (or 3–4 for high-risk).",
        "Fondaparinux is a factor Xa inhibitor but not a DOAC; has less APS-specific data but is not specifically contra-indicated.",
      ],
      keyTakeaway: "APS (often co-existing with SLE) → Avoid DOACs. Use LMWH or warfarin. The TRAPS trial confirmed rivaroxaban's inferiority in high-risk APS.",
    },
    confidenceScore: 0.88,
    quality: QUESTION_QUALITY.VERIFIED,
  },
  {
    stem: "A 55-year-old man is started on statins after a myocardial infarction. He reports muscle pain 4 weeks later. His CK is 3× the upper limit of normal. What is the most appropriate management?",
    options: ["Continue the statin — myalgia is a common and benign side effect", "Switch to a lower-dose or different statin after symptom resolution", "Permanently discontinue all statins", "Add CoQ10 supplementation and continue current statin"],
    correctIndex: 1,
    difficulty: 3,
    topicTags: ["Pharmacology", "Statins", "Myopathy", "Cardiovascular Secondary Prevention"],
    explanation: {
      correctWhy: "CK 3–10× ULN with symptoms = statin-associated myopathy. Temporarily stopping the statin and restarting at a lower dose or switching to a less myopathic statin (e.g., pravastatin, rosuvastatin) is appropriate. These patients still need lipid-lowering therapy post-MI.",
      whyOthersWrong: [
        "Continuing an implicated statin with CK elevation and symptoms risks progression to rhabdomyolysis.",
        "Permanent discontinuation is too extreme — a post-MI patient has major cardiovascular benefit from statin therapy.",
        "CoQ10 supplementation lacks strong evidence and should not replace dose adjustment.",
      ],
      keyTakeaway: "Statin myopathy algorithm: CK 3–10× + symptoms → withhold statin → recheck CK → reintroduce at lower dose or alternate statin. CK >10× = rhabdomyolysis risk; stop statin and hydrate aggressively.",
    },
    confidenceScore: 0.93,
    quality: QUESTION_QUALITY.VERIFIED,
  },
];

// ── Function ─────────────────────────────────────────────────────────────────

exports.seedSampleDeck = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);

    try {
      const userRef = db.doc(`users/${uid}`);
      const userSnap = await userRef.get();

      if (userSnap.exists && userSnap.data().hasSeenSampleDeck) {
        return ok({ courseId: null, questionCount: 0, alreadySeeded: true });
      }

      // ── Create a ghost sample course ──────────────────────────────────
      const courseRef = db.collection(`users/${uid}/courses`).doc();
      await courseRef.set({
        title: "Sample High-Yield Deck",
        examType: "SBA",
        examDate: null,
        isSampleDeck: true,
        availability: { monday: 60, tuesday: 60, wednesday: 60, thursday: 60, friday: 60, saturday: 30, sunday: 30 },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const courseId = courseRef.id;

      // ── Create a sample section ───────────────────────────────────────
      const sectionRef = db.collection(`users/${uid}/sections`).doc();
      await sectionRef.set({
        courseId,
        fileId: null,
        title: "Cardiology & Pharmacology — High-Yield SBAs",
        orderIndex: 0,
        aiStatus: "ANALYZED",
        questionsStatus: "COMPLETED",
        questionsCount: SAMPLE_QUESTIONS.length,
        estMinutes: 30,
        difficulty: 3,
        topicTags: ["Cardiology", "Pharmacology"],
        isSampleDeck: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const sectionId = sectionRef.id;

      // ── Batch-write sample questions ──────────────────────────────────
      const questionItems = SAMPLE_QUESTIONS.map((q) => ({
        ref: db.collection(`users/${uid}/questions`).doc(),
        data: {
          ...q,
          courseId,
          sectionId,
          sourceRef: { fileId: null, sectionId, label: "Sample Deck" },
          sourceCitations: [],
          flagCount: 0,
          stats: { timesAnswered: 0, timesCorrect: 0, avgTimeSec: 0 },
          isSampleDeck: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }));

      await batchSet(questionItems);

      // Mark user as seeded
      await userRef.set({ hasSeenSampleDeck: true }, { merge: true });

      log.info("Sample deck seeded", { uid, courseId, questionCount: SAMPLE_QUESTIONS.length });
      return ok({ courseId, questionCount: SAMPLE_QUESTIONS.length, alreadySeeded: false });
    } catch (error) {
      return safeError(error, "seed sample deck");
    }
  });
