# EC Core Exam Trainer (C_THR81)

A free study site for the **SAP Certified – SAP SuccessFactors Employee Central Core and Position Management** exam (C_THR81).

- **Trainer** (`index.html`) – topic quizzes, a timed knowledge check and weak-spot review. Progress is stored in each visitor's browser (localStorage); nothing is sent to a server.
- **Exam guide** (`guide.html`) – the system-based exam format, booking, staying certified and a six-week plan.
- **Study notes** (`notes/`) – key concepts, common traps and hands-on practice tasks for eight topic areas.

It is plain HTML, CSS and JavaScript with no build step and no external requests, so it runs on any static host (GitHub Pages, Netlify, Cloudflare Pages, your own web space).

## Adding questions

Questions live in `assets/questions.js`. Copy an entry and change it:

```js
{ id:"r9", area:"rbp", type:"single", prompt:"…",
  options:["…","…","…","…"],
  correct:[0], explanation:"…", ref:"Implementing Role-Based Permissions" },
```

- `id` must be unique and should never change (progress is stored per id).
- `area` is one of the ids in `AREAS` at the top of the file.
- `type` is `"single"` or `"multi"`; `correct` holds 0-based option indexes.

A topic quiz can be linked directly: `index.html#quiz=rbp`.

## Before going live in Germany

A public website run from Germany needs an **Impressum** and a **Datenschutzerklärung**. The site sets no cookies and loads no third-party resources, which keeps the privacy notice short, but your host's server logs still need to be covered.

## Disclaimer

Not affiliated with or endorsed by SAP. SAP and SAP SuccessFactors are trademarks or registered trademarks of SAP SE.
