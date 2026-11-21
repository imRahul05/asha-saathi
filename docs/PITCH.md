# ASHA Saathi: 3-minute pitch and demo script

Use only claims that are true today. Live URL: https://asha-saathi-mocha.vercel.app

## Before you go on stage (5 minutes)
- [ ] Open the live URL on the demo phone, sign in, pick **Hindi**, allow the microphone. Keep this tab ready.
- [ ] A second phone ("the doctor") has Telegram open on the alert bot chat.
- [ ] Check Agora minutes in the Console (need 40 or more) and that the PCU chart is low.
- [ ] Wi-Fi tested. Backup 90-second video is on the laptop, ready to play.
- [ ] Say nothing about WhatsApp. Telegram is the verified channel.

## Script (about 3 minutes)

### 1. The problem (20 s)
"After a home visit, an ASHA worker writes notes on paper, often hours later. A mother with dangerously high blood pressure can wait for someone to remember to tell the doctor. ASHA workers are the link between families and the health system, and that link depends on memory and paperwork."

### 2. The idea (15 s)
"ASHA Saathi is a voice-first action assistant. She talks about the visit in her own language. Saathi records it, checks it against fixed clinical rules, and, only after she says yes, alerts the doctor. We are not replacing government systems like SAMASTA. This is a conversational layer on top."

### 3. Live demo (about 100 s)
1. Point at the screen: "These are the things Saathi can record: blood pressure, Hb, weeks of pregnancy, symptoms. And this list says what it cannot do: no diagnosis, no medicines."
2. Tap start. Saathi greets in Hindi. Speak:
   *"Sunita Devi ke ghar gayi thi. Saat mahine. BP 150 by 100. Pairon mein sujan hai."*
3. Show: the transcript, then the red **HIGH RISK** card, the checklist ticks (BP, weeks, symptoms; Hb "not recorded"), and "Recorded in N seconds".
   Say: "The AI did not decide this. A written rule did, and it shows the reason and the source: BP 140/90 or higher, ICMR guidance."
4. Saathi says the doctor will be alerted in 10 seconds unless you say stop. A countdown with **Cancel** and **Send now** shows on screen. Let it run (or tap **Send now**), then hold up the doctor phone: it buzzes with the colour alert. (To show control, in another run say *"Ruko"* / tap **Cancel** and nothing is sent.)
5. Ask: *"Family ko iron ki goli ke bare mein kya batayein?"* Saathi answers from the official guideline and names the source.
6. Optional if time: tap **Talk to the doctor** and show the browser voice call link.

### 4. Why it is safe (25 s)
"Three safeguards. One: rules decide risk, not the AI, and every flag shows its source. Two: for a high-risk visit the doctor is alerted after a 10 second countdown that she can stop by voice or by tap, and the alert is sent only once. Three: health advice comes only from quotes of official government documents, checked against the PDFs. If it does not know, it says ask the Medical Officer. It refuses doses and diagnoses."

### 5. Built on (15 s)
"Agora Conversational AI for the real-time voice, Murf Falcon for the voice in nine Indian languages, tools running on Next.js with a Postgres database. The same rules engine works in any language."

### 6. Honest close (15 s)
"This is a prototype with sample data. Hindi is our tested path; other languages are supported but less tested. Next steps are a supervised trial with real ASHA workers and an ANM, clinical review of the rules, and authorised integration with government systems. Phone-call access for feature-phone users is on the roadmap."

## If something fails
| Problem | Do this |
|---|---|
| No captions appear | Carry on. The call and alert still work. Say "live captions hiccuped". Tap Retry if shown. |
| Alert says ready but not sent | Tap **Send now**. |
| Countdown fires by mistake | Tell the judges the alert is once-only and stoppable; show **Cancel** on the next run. |
| Agent does not join | Tap Retry once. Then play the backup video. |
| Wi-Fi dies | Play the backup video, narrate over it. |

## Likely judge questions
**Does SAMASTA already do this?** Karnataka has SAMASTA and we respect it. Saathi is not a new register; it is a voice layer that captures the visit and triggers action. A real deployment would integrate with it. Today we use our own sample database.

**Why AI, not a form?** A form needs navigation and typing. Speech lets her report in her own language, and AI is used only for understanding and explaining.

**Can the AI make a wrong medical decision?** It does not assign risk or diagnose. Fixed, cited rules do. She confirms before any alert. The rules still need clinical validation. For example, BP uses one reading while the guideline says two readings six hours apart, so we flag for assessment rather than diagnose.

**Where does the health advice come from?** Verbatim quotes from MoHFW, NHM and ICMR PDFs, verified against the page they cite. Not from the model's memory.

**Has it been used by real ASHA workers?** No. We tested with synthetic voices and automated checks. A supervised pilot is the next step.

**What does it cost to run?** Agora gives 300 free agent minutes, then about $0.10 per minute per the public price page; Murf, Neon and Vercel run on free tiers for the demo.

**What about privacy?** Demo data is private to each visitor and deleted after 24 hours. Alerts go only to the doctor on file. Saathi refuses to read out other people's details.

## Do not say
- That nothing is ever sent without a yes: high-risk alerts go out automatically after the countdown unless she stops them.
- That it replaces SAMASTA or removes duplicate entry.
- That it reduces maternal deaths or has clinical evidence.
- That WhatsApp works for the demo.
- That all nine languages are equally tested.
