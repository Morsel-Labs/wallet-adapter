import { springCssVars, spring } from './motion';
import { useIsoLayoutEffect } from './env';
import { useInsertionEffect } from 'react';

/**
 * The kit's whole stylesheet. Every selector is scoped under `.mw-scope` (or a `mw-` keyframe), so
 * nothing leaks into the host dApp, and host element rules (button, img, *) are neutralised inside.
 *
 * Theme tokens are CSS variables on `.mw-scope`; override any of them from the host, for example
 * `.mw-scope { --mw-accent: #ff6b00 }`, or pass `accentColor`.
 */
const css = (): string => {
  const s = spring('snappy');
  const b = spring('bouncy');
  return `
.mw-scope{
  --mw-accent:#0b63f6;--mw-accent-fg:#fff;
  --mw-bg:#fff;--mw-bg-2:#f5f6f8;--mw-bg-3:#eceef2;--mw-fg:#0d1117;--mw-fg-2:#4b5262;--mw-fg-3:#8a91a0;
  --mw-line:#e8eaee;--mw-overlay:rgba(14,17,24,.38);--mw-success:#13a156;--mw-danger:#e5484d;--mw-warn:#c2780a;
  --mw-shadow:0 1px 1px rgba(16,24,40,.04),0 10px 24px -8px rgba(16,24,40,.14),0 30px 70px -18px rgba(16,24,40,.28);
  --mw-pop-shadow:0 1px 2px rgba(16,24,40,.06),0 14px 34px -10px rgba(16,24,40,.24);
  --mw-radius:24px;--mw-radius-b:24px;
  --mw-font:Inter,"SF Pro Text",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mw-spring:cubic-bezier(.22,1,.36,1);--mw-spring-ms:${s.duration}ms;--mw-bounce:cubic-bezier(.34,1.56,.64,1);--mw-bounce-ms:${b.duration}ms;
  font-family:var(--mw-font);font-size:14px;line-height:1.4;color:var(--mw-fg);text-align:left;
  letter-spacing:normal;text-transform:none;font-weight:400;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  -webkit-tap-highlight-color:transparent;
}
@supports (animation-timing-function:linear(0,1)){.mw-scope{${springCssVars()}}}
.mw-scope[data-mw-theme=dark]{
  --mw-accent:#3d8bff;--mw-bg:#121419;--mw-bg-2:#1a1d24;--mw-bg-3:#242831;--mw-fg:#f3f5f8;--mw-fg-2:#a5acb9;--mw-fg-3:#6e7584;
  --mw-line:#252a33;--mw-overlay:rgba(0,0,0,.6);--mw-success:#2fbf71;--mw-danger:#ff6369;--mw-warn:#f0a32f;
  --mw-shadow:0 0 0 1px rgba(0,0,0,.25),0 24px 70px -14px rgba(0,0,0,.7);
  --mw-pop-shadow:0 0 0 1px rgba(0,0,0,.3),0 18px 40px -12px rgba(0,0,0,.7);
  color-scheme:dark;
}
.mw-scope *,.mw-scope *::before,.mw-scope *::after{box-sizing:border-box}
.mw-scope :where(h1,h2,h3,p,ul,li,figure){margin:0;padding:0;font:inherit;color:inherit;list-style:none}
.mw-scope:where(button),.mw-scope :where(button){appearance:none;-webkit-appearance:none;background:none;border:0;margin:0;padding:0;font:inherit;color:inherit;
  text-align:inherit;cursor:pointer;line-height:inherit;letter-spacing:inherit;text-transform:none;min-width:0;width:auto;height:auto;box-shadow:none;border-radius:0}
.mw-scope :where(a){color:inherit;text-decoration:none}
.mw-scope :where(img){display:block;max-width:none;border:0}
.mw-scope :where(input){font:inherit;color:inherit;margin:0}
.mw-scope:where(button):focus,.mw-scope :where(button,a,input,[tabindex]):focus{outline:none}
.mw-scope:where(button):focus-visible,.mw-scope :where(button,a,input,[tabindex]:not([tabindex="-1"])):focus-visible{outline:2px solid var(--mw-accent);outline-offset:2px}
.mw-scope svg{display:block;flex-shrink:0}

.mw-root{position:fixed;inset:0;z-index:var(--mw-z,2147483000);pointer-events:none}
.mw-overlay{position:absolute;inset:0;background:var(--mw-overlay);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);pointer-events:auto}
.mw-root[data-mw-place=anchor] .mw-overlay{background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none}
.mw-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px 16px;pointer-events:none}
.mw-root[data-mw-layout=sheet] .mw-wrap{align-items:flex-end;padding:0}
.mw-root[data-mw-place=anchor] .mw-wrap{display:block;padding:0}
.mw-card{position:relative;width:360px;max-width:100%;pointer-events:auto;isolation:isolate;transform-origin:50% 50%}
.mw-root[data-mw-place=anchor] .mw-card{position:absolute;transform-origin:100% 0}
.mw-root[data-mw-layout=sheet] .mw-card{width:100%;max-width:520px;margin:0 auto;--mw-radius-b:0px;transform-origin:50% 100%}
.mw-surface{position:absolute;inset:0;pointer-events:none;z-index:-1}
.mw-sl{position:absolute;left:0;right:0;background:var(--mw-bg);border:1px solid var(--mw-line);transform-origin:0 0}
.mw-sl-t{top:0;height:var(--mw-radius);border-bottom:0;border-radius:var(--mw-radius) var(--mw-radius) 0 0}
.mw-sl-m{top:calc(var(--mw-radius) - 1px);bottom:calc(var(--mw-radius-b) - 1px);border-top:0;border-bottom:0}
.mw-sl-b{bottom:0;height:max(var(--mw-radius-b),1px);border-top:0;border-radius:0 0 var(--mw-radius-b) var(--mw-radius-b)}
.mw-root[data-mw-layout=sheet] .mw-sl-b{height:1px;border:0}
.mw-shade{position:absolute;inset:0;border-radius:var(--mw-radius) var(--mw-radius) var(--mw-radius-b) var(--mw-radius-b);box-shadow:var(--mw-shadow);transform-origin:0 0}
.mw-content{position:relative}
.mw-root[data-mw-layout=sheet] .mw-content{padding-bottom:env(safe-area-inset-bottom,0px)}
.mw-ghost{position:absolute;pointer-events:none;margin:0}
.mw-ghost,.mw-ghost *,.mw-ghost *::before,.mw-ghost *::after{animation:none!important;transition:none!important}
.mw-flyer{position:absolute;margin:0;pointer-events:none;z-index:5;transform-origin:0 0;object-fit:contain}

.mw-grab{display:none;height:20px;align-items:center;justify-content:center;touch-action:none;cursor:grab}
.mw-grab::before{content:"";width:36px;height:4px;border-radius:4px;background:var(--mw-bg-3)}
.mw-root[data-mw-layout=sheet] .mw-grab{display:flex}
.mw-head{position:relative;display:grid;grid-template-columns:40px 1fr 40px;align-items:center;height:56px;padding:0 10px}
.mw-root[data-mw-layout=sheet] .mw-head{height:44px;margin-top:-4px;touch-action:none}
.mw-title{grid-column:2;text-align:center;font-size:15px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:center;gap:7px}
.mw-title img{width:18px;height:18px;border-radius:5px}
.mw-iconbtn{width:34px;height:34px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;color:var(--mw-fg-3);transition:background-color .15s,color .15s,transform .15s}
.mw-iconbtn:hover{background:var(--mw-bg-2);color:var(--mw-fg)}
.mw-iconbtn:active{transform:scale(.92)}
.mw-iconbtn.mw-sm{width:26px;height:26px;border-radius:8px}
.mw-head-l{grid-column:1;justify-self:start}
.mw-head-r{grid-column:3;justify-self:end}
.mw-head-l,.mw-head-r{display:flex}

.mw-view{padding:2px 16px 16px;outline:none}
.mw-scroll{max-height:min(68vh,560px);overflow-y:auto;overscroll-behavior:contain;margin:0 -16px;padding:0 16px;scrollbar-width:thin}
.mw-sub{margin:-6px 0 12px;text-align:center;font-size:13px;color:var(--mw-fg-2)}
.mw-stagger{animation:mw-rise var(--mw-spring-ms) var(--mw-spring) both;animation-delay:calc(var(--i,0) * 32ms + 40ms)}
@keyframes mw-rise{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}

.mw-hero{position:relative;display:flex;align-items:center;gap:12px;width:100%;padding:13px 12px 13px 13px;border-radius:18px;overflow:hidden;
  background:linear-gradient(180deg,color-mix(in srgb,var(--mw-accent) 7%,var(--mw-bg)),color-mix(in srgb,var(--mw-accent) 2.5%,var(--mw-bg)));
  border:1px solid color-mix(in srgb,var(--mw-accent) 20%,var(--mw-line));transition:border-color .2s,transform .2s,box-shadow .2s}
.mw-hero:hover{border-color:color-mix(in srgb,var(--mw-accent) 42%,var(--mw-line));box-shadow:0 8px 20px -12px color-mix(in srgb,var(--mw-accent) 60%,transparent)}
.mw-hero:active{transform:scale(.985)}
.mw-hero::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.38) 50%,transparent 65%);opacity:0;transform:translateX(-100%);
  animation:mw-sheen 1.6s .5s cubic-bezier(.4,0,.2,1) 1 both}
.mw-scope[data-mw-theme=dark] .mw-hero::after{background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.09) 50%,transparent 70%)}
@keyframes mw-sheen{0%{transform:translateX(-100%);opacity:1}100%{transform:translateX(100%);opacity:1}}
.mw-hero-logo{position:relative;width:44px;height:44px;flex-shrink:0}
.mw-hero-logo::before{content:"";position:absolute;inset:4px;border-radius:50%;box-shadow:0 6px 16px -2px color-mix(in srgb,var(--mw-accent) 55%,transparent)}
.mw-logo-img{width:100%;height:100%;object-fit:contain;-webkit-user-drag:none;user-select:none}
.mw-hero-logo .mw-logo-img{position:relative;width:44px;height:44px}
.mw-hero-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.mw-hero-name{display:flex;align-items:center;gap:7px;font-size:15px;font-weight:600;letter-spacing:-.01em}
.mw-hero-sub{font-size:12.5px;color:var(--mw-fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mw-tag{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:6px;font-size:10.5px;font-weight:600;letter-spacing:.01em;
  color:var(--mw-accent);background:color-mix(in srgb,var(--mw-accent) 12%,transparent)}
.mw-pill{flex-shrink:0;display:inline-flex;align-items:center;height:30px;padding:0 13px;border-radius:999px;font-size:13px;font-weight:600;
  color:var(--mw-accent-fg);background:var(--mw-accent);box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 4px 10px -4px color-mix(in srgb,var(--mw-accent) 70%,transparent)}

.mw-label{margin:14px 4px 6px;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mw-fg-3)}
.mw-list{display:flex;flex-direction:column;gap:2px}
.mw-row{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:8px 10px;border-radius:14px;transition:background-color .15s,transform .15s}
.mw-row:hover{background:var(--mw-bg-2)}
.mw-row:active{transform:scale(.985)}
.mw-row-icon{width:34px;height:34px;border-radius:10px;flex-shrink:0;object-fit:cover;background:var(--mw-bg-2)}
.mw-row-name{flex:1;min-width:0;font-size:14px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mw-row-meta{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--mw-fg-3)}
.mw-dot{width:7px;height:7px;border-radius:50%;background:var(--mw-success);flex-shrink:0}
.mw-dot-warn{background:var(--mw-warn)}
.mw-row-more{color:var(--mw-fg-2)}
.mw-row-more .mw-row-name{font-weight:500}
.mw-stack{display:flex;align-items:center}
.mw-stack img{width:20px;height:20px;border-radius:6px;box-shadow:0 0 0 2px var(--mw-bg);object-fit:cover;background:var(--mw-bg-2)}
.mw-stack img+img{margin-left:-6px}
.mw-more-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--mw-bg-2);color:var(--mw-fg-2);flex-shrink:0}
.mw-chev{color:var(--mw-fg-3)}
.mw-empty{padding:22px 0;text-align:center;font-size:13px;color:var(--mw-fg-3)}
.mw-search{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;margin-bottom:8px;border-radius:12px;background:var(--mw-bg-2);color:var(--mw-fg-3);border:1px solid transparent;transition:border-color .15s}
.mw-search:focus-within{border-color:color-mix(in srgb,var(--mw-accent) 50%,transparent)}
.mw-search input{flex:1;min-width:0;height:100%;border:0;background:transparent;font-size:14px;color:var(--mw-fg)}
.mw-search input::placeholder{color:var(--mw-fg-3)}

.mw-seg{display:flex;padding:3px;gap:2px;margin-bottom:12px;border-radius:12px;background:var(--mw-bg-2)}
.mw-seg button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;border-radius:9px;font-size:12.5px;font-weight:550;color:var(--mw-fg-2);transition:background-color .15s,color .15s}
.mw-seg button[aria-pressed=true]{background:var(--mw-bg);color:var(--mw-fg);box-shadow:0 1px 2px rgba(16,24,40,.08)}
.mw-seg img{width:16px;height:16px;border-radius:50%}

.mw-foot{margin-top:14px;padding-top:12px;border-top:1px solid var(--mw-line);display:flex;align-items:center;justify-content:center;gap:5px;font-size:12.5px;color:var(--mw-fg-3)}
.mw-link{color:var(--mw-accent);font-weight:600;border-radius:6px}
.mw-link:hover{text-decoration:underline;text-underline-offset:2px}
.mw-powered{margin-top:8px;text-align:center;font-size:11.5px;color:var(--mw-fg-3)}

.mw-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:0 16px;border-radius:13px;font-size:14px;font-weight:600;white-space:nowrap;transition:background-color .15s,transform .15s,box-shadow .15s,color .15s}
.mw-btn:active{transform:scale(.97)}
.mw-btn-primary{color:var(--mw-accent-fg);background:var(--mw-accent);box-shadow:0 1px 0 rgba(255,255,255,.16) inset,0 6px 14px -8px color-mix(in srgb,var(--mw-accent) 80%,transparent)}
.mw-btn-primary:hover{background:color-mix(in srgb,var(--mw-accent) 88%,#000)}
.mw-btn-soft{background:var(--mw-bg-2);color:var(--mw-fg)}
.mw-btn-soft:hover{background:var(--mw-bg-3)}
.mw-btn-ghost{color:var(--mw-fg-2);height:36px;font-weight:550;font-size:13px}
.mw-btn-ghost:hover{color:var(--mw-fg);background:var(--mw-bg-2)}
.mw-btn-block{width:100%}
.mw-btn-lg{height:48px;font-size:15px;border-radius:15px}
.mw-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}

.mw-qr-wrap{display:flex;flex-direction:column;align-items:center}
.mw-qr-frame{position:relative;padding:14px;border-radius:24px;background:#fff;box-shadow:0 0 0 1px rgba(16,24,40,.06),0 10px 30px -14px rgba(16,24,40,.35)}
.mw-scope[data-mw-theme=dark] .mw-qr-frame{box-shadow:0 0 0 1px rgba(255,255,255,.04),0 14px 34px -14px rgba(0,0,0,.8)}
.mw-qr-frame::before{content:"";position:absolute;inset:-1px;border-radius:25px;pointer-events:none;
  box-shadow:0 0 0 2px color-mix(in srgb,var(--mw-accent) 55%,transparent);opacity:0}
.mw-qr-frame[data-live=true]::before{animation:mw-ring 2.4s cubic-bezier(.2,.6,.3,1) infinite}
@keyframes mw-ring{0%{opacity:.75;transform:scale(1)}100%{opacity:0;transform:scale(1.08)}}
.mw-qr{position:relative;overflow:hidden;border-radius:6px}
.mw-qr-svg{display:block}
.mw-qr-band{fill:#0d1320;transform-box:fill-box;transform-origin:center;animation:mw-qr-in 620ms var(--mw-spring) both;animation-delay:calc(var(--b) * 55ms + 60ms)}
.mw-qr-eye{fill:#0d1320;transform-box:fill-box;transform-origin:center;animation:mw-qr-eye var(--mw-bounce-ms) var(--mw-bounce) both;animation-delay:calc(var(--b) * 70ms)}
.mw-qr-pupil{fill:var(--mw-qr-pupil,#0b63f6)}
@keyframes mw-qr-in{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:none}}
@keyframes mw-qr-eye{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
.mw-qr::after{content:"";position:absolute;inset:-20% 0;pointer-events:none;
  background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--mw-accent) 14%,transparent) 50%,transparent);transform:translateY(-100%);opacity:0}
.mw-qr-frame[data-live=true] .mw-qr::after{animation:mw-scan 3.6s 1.2s cubic-bezier(.45,0,.55,1) infinite}
@keyframes mw-scan{0%{transform:translateY(-70%);opacity:0}15%{opacity:1}70%{opacity:1}100%{transform:translateY(70%);opacity:0}}
.mw-qr-plate{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 0 1px rgba(16,24,40,.06),0 4px 12px -4px rgba(16,24,40,.25)}
.mw-qr-skel{border-radius:6px;background:linear-gradient(110deg,#f1f3f6 30%,#e6e9ee 50%,#f1f3f6 70%);background-size:220% 100%;animation:mw-shimmer 1.3s linear infinite}
@keyframes mw-shimmer{to{background-position:-120% 0}}
.mw-qr-frame[data-expired=true] .mw-qr{opacity:.12;filter:blur(2px);transition:opacity .3s}
.mw-qr-over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#0d1117;
  animation:mw-fade .25s ease both}
.mw-qr-over strong{font-size:14px;font-weight:600}
.mw-qr-over .mw-btn{height:36px;font-size:13px}
@keyframes mw-fade{from{opacity:0}to{opacity:1}}
.mw-qr-title{margin-top:16px;font-size:16px;font-weight:600;letter-spacing:-.01em;text-align:center}
.mw-qr-text{margin-top:4px;font-size:13px;color:var(--mw-fg-2);text-align:center;max-width:280px;text-wrap:balance}
.mw-status{margin-top:12px;display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 6px 0 11px;border-radius:999px;background:var(--mw-bg-2);font-size:12.5px;color:var(--mw-fg-2)}
.mw-status[data-tone=warn] .mw-timer{color:var(--mw-warn)}
.mw-timer{font-variant-numeric:tabular-nums;color:var(--mw-fg-3)}
.mw-sep{width:3px;height:3px;border-radius:50%;background:var(--mw-fg-3);opacity:.6}
.mw-pulse{position:relative;width:8px;height:8px;border-radius:50%;background:var(--mw-accent)}
.mw-pulse::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--mw-accent);animation:mw-pulse 1.6s cubic-bezier(.2,.6,.3,1) infinite}
@keyframes mw-pulse{from{transform:scale(1);opacity:.6}to{transform:scale(2.8);opacity:0}}
.mw-qr-actions{margin-top:14px;padding-top:12px;border-top:1px solid var(--mw-line);width:100%}

.mw-center{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:10px}
.mw-orbit{position:relative;width:96px;height:96px;display:flex;align-items:center;justify-content:center}
.mw-orbit-ring{position:absolute;inset:0;border-radius:50%;
  background:conic-gradient(from 0deg,transparent 0deg,transparent 220deg,color-mix(in srgb,var(--mw-accent) 70%,transparent) 330deg,var(--mw-accent) 360deg);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px));
  animation:mw-spin 1.1s linear infinite}
.mw-orbit-track{position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 2.5px var(--mw-bg-3)}
@keyframes mw-spin{to{transform:rotate(360deg)}}
.mw-orbit .mw-logo-img,.mw-orbit-icon{width:64px;height:64px;border-radius:18px;object-fit:contain}
.mw-orbit-icon{object-fit:cover}
.mw-badge{position:absolute;right:6px;bottom:6px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  color:#fff;box-shadow:0 0 0 3px var(--mw-bg);animation:mw-pop var(--mw-bounce-ms) var(--mw-bounce) both;animation-delay:.12s}
.mw-badge-ok{background:var(--mw-success)}
.mw-badge-bad{background:var(--mw-danger)}
.mw-badge-info{background:var(--mw-bg);color:var(--mw-fg);box-shadow:0 0 0 3px var(--mw-bg),0 2px 8px rgba(16,24,40,.2)}
@keyframes mw-pop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
.mw-burst{position:absolute;inset:8px;border-radius:50%;border:2px solid var(--mw-success);opacity:0;animation:mw-burst .9s .1s cubic-bezier(.2,.7,.3,1) both}
@keyframes mw-burst{from{opacity:.7;transform:scale(.7)}to{opacity:0;transform:scale(1.35)}}
.mw-shake{animation:mw-shake .5s cubic-bezier(.36,.07,.19,.97) both}
@keyframes mw-shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}
.mw-h{margin-top:16px;font-size:18px;font-weight:650;letter-spacing:-.02em;text-wrap:balance}
.mw-p{margin-top:6px;font-size:13.5px;line-height:1.5;color:var(--mw-fg-2);max-width:290px;text-wrap:balance}
.mw-origin{margin-top:14px;display:inline-flex;align-items:center;gap:6px;max-width:100%;height:28px;padding:0 11px;border-radius:999px;background:var(--mw-bg-2);font-size:12px;color:var(--mw-fg-2)}
.mw-origin span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mw-actions{margin-top:18px;width:100%;display:flex;flex-direction:column;gap:6px}
.mw-addr{margin-top:12px;display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 5px;border-radius:999px;background:var(--mw-bg-2);font-size:13px;font-weight:550;font-variant-numeric:tabular-nums}
.mw-ava{border-radius:50%;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}

.mw-get-art{position:relative;width:100%;height:116px;display:flex;align-items:center;justify-content:center;margin-top:-4px}
.mw-get-art::before{content:"";position:absolute;width:200px;height:120px;border-radius:50%;
  background:radial-gradient(closest-side,color-mix(in srgb,var(--mw-accent) 26%,transparent),transparent)}
.mw-get-ring{position:absolute;width:104px;height:104px;border-radius:50%;border:1px solid color-mix(in srgb,var(--mw-accent) 22%,transparent)}
.mw-get-ring+.mw-get-ring{width:150px;height:150px;opacity:.55}
.mw-get-logo{position:relative;width:76px;height:76px;animation:mw-float 5s ease-in-out infinite}
.mw-get-logo .mw-logo-img{width:76px;height:76px;filter:drop-shadow(0 10px 18px color-mix(in srgb,var(--mw-accent) 45%,transparent))}
@keyframes mw-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.mw-chip-float{position:absolute;display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px 0 4px;border-radius:999px;font-size:11px;font-weight:600;
  background:var(--mw-bg);color:var(--mw-fg-2);box-shadow:var(--mw-pop-shadow);animation:mw-float 6s ease-in-out infinite}
.mw-chip-float i{width:16px;height:16px;border-radius:50%;display:block}
.mw-get-h{text-align:center;font-size:19px;font-weight:650;letter-spacing:-.02em}
.mw-get-p{margin-top:4px;text-align:center;font-size:13.5px;color:var(--mw-fg-2);text-wrap:balance}
.mw-props{margin-top:16px;display:flex;flex-direction:column;gap:2px}
.mw-prop{display:flex;align-items:center;gap:12px;padding:7px 4px}
.mw-prop-ico{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--mw-accent);background:color-mix(in srgb,var(--mw-accent) 10%,transparent)}
.mw-prop b{display:block;font-size:13.5px;font-weight:600}
.mw-prop small{display:block;font-size:12px;color:var(--mw-fg-3)}
.mw-dl{margin-top:14px;padding:12px;border-radius:18px;background:var(--mw-bg-2);display:flex;gap:14px;align-items:center}
.mw-dl-qr{padding:7px;border-radius:12px;background:#fff;flex-shrink:0;box-shadow:0 0 0 1px rgba(16,24,40,.06)}
.mw-dl-qr .mw-qr-band,.mw-dl-qr .mw-qr-eye{animation-duration:0s}
.mw-dl-side{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.mw-dl-side p{font-size:12px;color:var(--mw-fg-2);margin-bottom:2px}
.mw-store{display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;border-radius:10px;background:var(--mw-fg);color:var(--mw-bg);font-size:12.5px;font-weight:600;transition:transform .15s,opacity .15s}
.mw-store:hover{opacity:.88}
.mw-store:active{transform:scale(.97)}
.mw-store small{font-weight:500;opacity:.7;margin-left:auto;font-size:11px}
.mw-stores{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mw-stores .mw-store{height:46px;justify-content:center;font-size:14px;border-radius:14px}
.mw-more-link{display:flex;justify-content:center;margin-top:12px}

.mw-cbtn{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px 0 12px;border-radius:999px;font-size:14px;font-weight:600;
  color:var(--mw-accent-fg);background:var(--mw-accent);white-space:nowrap;
  box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 6px 16px -8px color-mix(in srgb,var(--mw-accent) 85%,transparent);transition:transform .16s,background-color .16s,box-shadow .16s}
.mw-cbtn:hover{background:color-mix(in srgb,var(--mw-accent) 90%,#000)}
.mw-cbtn:active{transform:scale(.96)}
.mw-cbtn[disabled]{cursor:default;opacity:.85}
.mw-cbtn .mw-logo-img{width:20px;height:20px}
.mw-cbtn.mw-sm{height:34px;font-size:13px;padding:0 13px 0 9px}
.mw-spin{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:mw-spin .7s linear infinite}
.mw-chip{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 10px 0 5px;border-radius:999px;font-size:13.5px;font-weight:600;white-space:nowrap;
  color:var(--mw-fg);background:var(--mw-bg);border:1px solid var(--mw-line);box-shadow:0 1px 2px rgba(16,24,40,.05);
  font-variant-numeric:tabular-nums;transition:transform .16s,background-color .16s,border-color .16s}
.mw-chip:hover{background:var(--mw-bg-2)}
.mw-chip:active{transform:scale(.97)}
.mw-chip[aria-expanded=true] .mw-chev{transform:rotate(180deg)}
.mw-chev{transition:transform .2s}
.mw-chip-ava{position:relative;width:28px;height:28px;flex-shrink:0}
.mw-chip-ava .mw-ava{width:28px;height:28px}
.mw-chip-wallet{position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border-radius:5px;background:var(--mw-bg);padding:1px;box-shadow:0 0 0 1.5px var(--mw-bg)}
.mw-chip-wallet img{width:100%;height:100%;border-radius:4px;object-fit:contain}
.mw-chip-bal{padding-left:8px;margin-left:1px;border-left:1px solid var(--mw-line);color:var(--mw-fg-2);font-weight:550}
.mw-chip.mw-sm{height:34px}
@media (max-width:480px){.mw-chip-bal{display:none}}
.mw-chip.mw-sm .mw-chip-ava,.mw-chip.mw-sm .mw-chip-ava .mw-ava{width:24px;height:24px}

.mw-menu{position:fixed;z-index:var(--mw-z,2147483000);width:288px;max-width:calc(100vw - 24px);padding:6px;border-radius:20px;
  background:var(--mw-bg);border:1px solid var(--mw-line);box-shadow:var(--mw-pop-shadow);transform-origin:100% 0}
.mw-menu-head{display:flex;flex-direction:column;align-items:center;padding:16px 12px 12px;text-align:center}
.mw-menu-ava{position:relative;width:56px;height:56px}
.mw-menu-ava .mw-ava{width:56px;height:56px}
.mw-menu-ava .mw-chip-wallet{width:22px;height:22px;border-radius:7px;right:-4px;bottom:-4px;padding:2px}
.mw-menu-addr{margin-top:10px;display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.mw-menu-bal{margin-top:2px;font-size:13px;color:var(--mw-fg-2)}
.mw-menu-via{margin-top:2px;font-size:12px;color:var(--mw-fg-3)}
.mw-menu-sep{height:1px;background:var(--mw-line);margin:4px 6px}
.mw-item{display:flex;align-items:center;gap:11px;width:100%;height:42px;padding:0 10px;border-radius:13px;font-size:14px;font-weight:550;transition:background-color .12s}
.mw-item:hover,.mw-item:focus-visible{background:var(--mw-bg-2);outline:none}
.mw-item svg{color:var(--mw-fg-3)}
.mw-item-danger{color:var(--mw-danger)}
.mw-item-danger svg{color:currentColor}
.mw-item-check{color:var(--mw-success)!important;animation:mw-pop var(--mw-bounce-ms) var(--mw-bounce) both}

.mw-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}

@media (prefers-reduced-motion:reduce){
  .mw-scope *,.mw-scope *::before,.mw-scope *::after{animation-duration:1ms!important;animation-iteration-count:1!important;animation-delay:0s!important;transition-duration:1ms!important}
  .mw-orbit-ring{animation:none!important;transform:rotate(200deg)}
  .mw-qr-frame[data-live=true]::before,.mw-qr::after,.mw-hero::after{animation:none!important;opacity:0!important}
}
`;
};

let cached: string | null = null;
/** The kit's CSS as a string, for SSR `<style>` tags or strict-CSP setups (use with a nonce). */
export function getMorselConnectCss(): string {
  if (cached) return cached;
  // Double the leading class of every selector (".mw-btn" -> ".mw-btn.mw-btn"). Every rule gains the
  // same specificity, so the cascade between our own rules is unchanged, but host rules such as
  // `[type=button]{background:transparent}` (0,1,0) can no longer win a tie by loading later.
  cached = css()
    .replace(/(^|[{},]\s*)(\.mw-[a-z0-9-]+)/gm, '$1$2$2')
    .replace(/\n\s*/g, '\n')
    .trim();
  return cached;
}

const STYLE_ID = 'morsel-connect-styles';
const useInsert: typeof useInsertionEffect = typeof useInsertionEffect === 'function' ? useInsertionEffect : (useIsoLayoutEffect as any);

/** Inject the stylesheet once per document (client only). */
export function useKitStyles(nonce?: string): void {
  useInsert(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    if (nonce) el.setAttribute('nonce', nonce);
    el.textContent = getMorselConnectCss();
    document.head.appendChild(el);
  }, [nonce]);
}
