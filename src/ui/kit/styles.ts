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
  --mw-bg:#fff;--mw-bg-2:#f4f5f8;--mw-bg-3:#e9ecf2;--mw-fg:#0b0e14;--mw-fg-2:#3d4554;--mw-fg-3:#646c7c;
  --mw-line:rgba(14,22,40,.08);--mw-overlay:rgba(11,14,20,.28);--mw-success:#12a46b;--mw-danger:#e5484d;--mw-warn:#a15c00;
  --mw-shadow:0 30px 60px -30px rgba(14,22,40,.3),0 12px 24px -12px rgba(14,22,40,.1);
  --mw-pop-shadow:0 8px 24px -12px rgba(14,22,40,.18),0 2px 6px rgba(14,22,40,.05);
  --mw-radius:24px;--mw-radius-b:24px;
  --mw-font:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mw-spring:cubic-bezier(.22,1,.36,1);--mw-spring-ms:${s.duration}ms;--mw-bounce:cubic-bezier(.34,1.56,.64,1);--mw-bounce-ms:${b.duration}ms;
  font-family:var(--mw-font);font-size:14px;line-height:1.4;color:var(--mw-fg);text-align:left;
  letter-spacing:normal;text-transform:none;font-weight:400;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  -webkit-tap-highlight-color:transparent;
}
@supports (animation-timing-function:linear(0,1)){.mw-scope{${springCssVars()}}}
.mw-scope[data-mw-theme=dark]{
  --mw-accent:#3d8bff;--mw-bg:#111318;--mw-bg-2:#1a1d23;--mw-bg-3:#252931;--mw-fg:#f2f4f7;--mw-fg-2:#a3aab6;--mw-fg-3:#7f8695;
  --mw-line:rgba(255,255,255,.07);--mw-overlay:rgba(0,0,0,.55);--mw-success:#2fbf71;--mw-danger:#ff6369;--mw-warn:#f0a32f;
  --mw-shadow:0 30px 70px -24px rgba(0,0,0,.7);
  --mw-pop-shadow:0 18px 40px -12px rgba(0,0,0,.6);
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
.mw-overlay{position:absolute;inset:0;background:var(--mw-overlay);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);pointer-events:auto}
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
.mw-iconbtn:active{transform:scale(.94)}
.mw-head-l{grid-column:1;justify-self:start}
.mw-head-r{grid-column:3;justify-self:end}
.mw-head-l,.mw-head-r{display:flex}

.mw-view{padding:0 16px 18px;outline:none}
.mw-scroll{max-height:min(68vh,560px);overflow-y:auto;overscroll-behavior:contain;margin:0 -16px;padding:0 16px;scrollbar-width:thin}
.mw-sub{margin:-6px 0 14px;text-align:center;font-size:13px;color:var(--mw-fg-3)}
.mw-stagger{animation:mw-rise var(--mw-spring-ms) var(--mw-spring) both;animation-delay:calc(var(--i,0) * 24ms + 30ms)}
@keyframes mw-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.mw-hero{display:flex;align-items:center;gap:12px;width:100%;padding:12px;border-radius:16px;background:var(--mw-bg-2);transition:background-color .15s,transform .15s}
.mw-hero:hover{background:var(--mw-bg-3)}
.mw-hero:active{transform:scale(.99)}
.mw-hero-logo{width:40px;height:40px;flex-shrink:0}
.mw-logo-img{width:100%;height:100%;object-fit:contain;-webkit-user-drag:none;user-select:none}
.mw-hero-logo .mw-logo-img{width:40px;height:40px}
.mw-hero-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.mw-hero-name{font-size:15px;font-weight:600;letter-spacing:-.01em}
.mw-hero-sub{font-size:12.5px;color:var(--mw-fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mw-pill{flex-shrink:0;display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:600;
  color:var(--mw-accent-fg);background:var(--mw-accent);transition:background-color .15s}
.mw-hero:hover .mw-pill{background:color-mix(in srgb,var(--mw-accent) 90%,#000)}

.mw-label{margin:16px 10px 4px;font-size:12px;font-weight:500;color:var(--mw-fg-3)}
.mw-list{display:flex;flex-direction:column;gap:2px}
.mw-hero+.mw-list{margin-top:8px}
.mw-row{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:8px 10px;border-radius:14px;transition:background-color .15s,transform .15s}
.mw-row:hover{background:var(--mw-bg-2)}
.mw-row:active{transform:scale(.99)}
.mw-row-icon{width:32px;height:32px;border-radius:9px;flex-shrink:0;object-fit:cover;background:var(--mw-bg-2)}
.mw-row-name{flex:1;min-width:0;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mw-row-meta{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--mw-fg-3)}
.mw-dot{width:6px;height:6px;border-radius:50%;background:var(--mw-success);flex-shrink:0}
.mw-row-more{color:var(--mw-fg-2)}
.mw-more-ico{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:var(--mw-bg-2);color:var(--mw-fg-3);flex-shrink:0}
.mw-chev{color:var(--mw-fg-3);transition:transform .2s}
.mw-empty{padding:22px 0;text-align:center;font-size:13px;color:var(--mw-fg-3)}
.mw-search{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;margin-bottom:8px;border-radius:12px;background:var(--mw-bg-2);color:var(--mw-fg-3);border:1px solid transparent;transition:border-color .15s}
.mw-search:focus-within{border-color:color-mix(in srgb,var(--mw-accent) 50%,transparent)}
.mw-search input{flex:1;min-width:0;height:100%;border:0;background:transparent;font-size:14px;color:var(--mw-fg)}
.mw-search input::placeholder{color:var(--mw-fg-3)}

.mw-seg{display:flex;padding:3px;gap:2px;margin-bottom:12px;border-radius:12px;background:var(--mw-bg-2)}
.mw-seg button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;border-radius:9px;font-size:12.5px;font-weight:500;color:var(--mw-fg-2);transition:background-color .15s,color .15s}
.mw-seg button[aria-pressed=true]{background:var(--mw-bg);color:var(--mw-fg);box-shadow:0 1px 2px rgba(14,22,40,.08)}
.mw-seg img{width:16px;height:16px;border-radius:50%}

.mw-foot{margin-top:14px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:13px;color:var(--mw-fg-3)}
.mw-link{color:var(--mw-fg);font-weight:500;border-radius:6px}
.mw-link:hover{text-decoration:underline;text-underline-offset:3px}
.mw-link-quiet{color:var(--mw-fg-3)}
.mw-link-quiet:hover{color:var(--mw-fg-2)}
.mw-powered{margin-top:8px;text-align:center;font-size:11.5px;color:var(--mw-fg-3)}

.mw-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 16px;border-radius:14px;font-size:14px;font-weight:600;white-space:nowrap;transition:background-color .15s,color .15s,transform .15s}
.mw-btn:active{transform:scale(.98)}
.mw-btn-primary{color:var(--mw-accent-fg);background:var(--mw-accent)}
.mw-btn-primary:hover{background:color-mix(in srgb,var(--mw-accent) 90%,#000)}
.mw-btn-ghost{height:38px;color:var(--mw-fg-2);font-weight:500;font-size:13.5px}
.mw-btn-ghost:hover{color:var(--mw-fg);background:var(--mw-bg-2)}
.mw-btn-block{width:100%}
.mw-btn-lg{height:48px;font-size:15px;border-radius:16px}

.mw-qr-wrap{display:flex;flex-direction:column;align-items:center;padding-top:2px}
.mw-qr-frame{position:relative;padding:14px;border-radius:22px;background:#fff;box-shadow:0 0 0 1px var(--mw-line)}
.mw-qr{position:relative;overflow:hidden;border-radius:4px}
.mw-qr-svg{display:block}
.mw-qr-band{fill:#0b0e14;transform-box:fill-box;transform-origin:center;animation:mw-qr-in 620ms var(--mw-spring) both;animation-delay:calc(var(--b) * 55ms + 60ms)}
.mw-qr-eye{fill:#0b0e14;transform-box:fill-box;transform-origin:center;animation:mw-qr-in 520ms var(--mw-spring) both;animation-delay:calc(var(--b) * 70ms)}
.mw-qr-pupil{fill:var(--mw-qr-pupil,#0b0e14)}
@keyframes mw-qr-in{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:none}}
.mw-qr-plate{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px rgba(14,22,40,.06)}
.mw-qr-skel{border-radius:6px;background:linear-gradient(110deg,#f1f3f6 30%,#e6e9ee 50%,#f1f3f6 70%);background-size:220% 100%;animation:mw-shimmer 1.3s linear infinite}
@keyframes mw-shimmer{to{background-position:-120% 0}}
.mw-qr-frame[data-expired=true] .mw-qr{opacity:.08;filter:blur(2px);transition:opacity .3s}
.mw-qr-over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#0b0e14;animation:mw-fade .25s ease both}
.mw-qr-over strong{font-size:14px;font-weight:600}
.mw-qr-over .mw-btn{height:36px;font-size:13px;border-radius:12px}
@keyframes mw-fade{from{opacity:0}to{opacity:1}}
.mw-qr-wrap .mw-h{margin-top:18px}
.mw-status{margin-top:4px;font-size:13px;color:var(--mw-fg-3);font-variant-numeric:tabular-nums}
.mw-status[data-tone=warn]{color:var(--mw-warn)}

.mw-center{display:flex;flex-direction:column;align-items:center;text-align:center;padding:4px 0 6px}
.mw-orbit{position:relative;width:88px;height:88px;display:flex;align-items:center;justify-content:center}
.mw-orbit-ring{position:absolute;inset:0;border-radius:50%;
  background:conic-gradient(from 0deg,transparent 0deg,transparent 240deg,color-mix(in srgb,var(--mw-accent) 60%,transparent) 330deg,var(--mw-accent) 360deg);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.5px));mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.5px));
  animation:mw-spin 1.2s linear infinite}
.mw-orbit-track{position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 2px var(--mw-bg-2)}
@keyframes mw-spin{to{transform:rotate(360deg)}}
.mw-orbit .mw-logo-img,.mw-orbit-icon{width:60px;height:60px;border-radius:16px;object-fit:contain}
.mw-orbit-icon{object-fit:cover}
.mw-badge{position:absolute;right:6px;bottom:6px;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  color:#fff;box-shadow:0 0 0 3px var(--mw-bg);animation:mw-pop 420ms var(--mw-spring) both;animation-delay:.1s}
.mw-badge-ok{background:var(--mw-success)}
.mw-badge-bad{background:var(--mw-danger)}
.mw-badge-info{background:var(--mw-bg);color:var(--mw-fg-2);box-shadow:0 0 0 3px var(--mw-bg),0 2px 8px rgba(14,22,40,.16)}
@keyframes mw-pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:none}}
.mw-h{margin-top:14px;font-size:17px;font-weight:600;letter-spacing:-.015em;text-wrap:balance}
.mw-p{margin-top:6px;font-size:13.5px;line-height:1.5;color:var(--mw-fg-2);max-width:280px;text-wrap:balance}
.mw-origin{margin-top:12px;display:inline-flex;align-items:center;gap:6px;max-width:100%;height:28px;padding:0 11px;border-radius:999px;background:var(--mw-bg-2);font-size:12.5px;color:var(--mw-fg-2)}
.mw-origin svg{color:var(--mw-fg-3)}
.mw-origin span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mw-actions{margin-top:20px;width:100%;display:flex;flex-direction:column;gap:4px}
.mw-addr{margin-top:12px;display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 5px;border-radius:999px;background:var(--mw-bg-2);font-size:13px;font-weight:500;font-variant-numeric:tabular-nums}
.mw-ava{border-radius:50%;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}

.mw-get-head{padding-top:6px}
.mw-get-logo{width:56px;height:56px}
.mw-dl{margin-top:20px;padding:10px;border-radius:18px;background:var(--mw-bg-2);display:flex;gap:12px;align-items:center}
.mw-dl-qr{padding:8px;border-radius:12px;background:#fff;flex-shrink:0}
.mw-dl-qr .mw-qr-band,.mw-dl-qr .mw-qr-eye{animation-duration:0s}
.mw-dl-side{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.mw-dl-side p{margin:0 0 3px 8px;font-size:12px;color:var(--mw-fg-3)}
.mw-store{display:flex;align-items:center;gap:9px;height:32px;padding:0 8px;border-radius:9px;font-size:13px;font-weight:500;color:var(--mw-fg);transition:background-color .15s}
.mw-store:hover{background:var(--mw-bg)}
.mw-store span{flex:1;min-width:0}
.mw-store svg:last-child{color:var(--mw-fg-3)}

.mw-cbtn{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px 0 12px;border-radius:999px;font-size:14px;font-weight:600;
  color:var(--mw-accent-fg);background:var(--mw-accent);white-space:nowrap;transition:transform .16s,background-color .16s}
.mw-cbtn:hover{background:color-mix(in srgb,var(--mw-accent) 90%,#000)}
.mw-cbtn:active{transform:scale(.97)}
.mw-cbtn[disabled]{cursor:default;opacity:.85}
.mw-cbtn .mw-logo-img{width:20px;height:20px}
.mw-cbtn.mw-sm{height:34px;font-size:13px;padding:0 13px 0 9px}
.mw-spin{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:mw-spin .7s linear infinite}
.mw-chip{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 12px 0 6px;border-radius:999px;font-size:13.5px;font-weight:600;white-space:nowrap;
  color:var(--mw-fg);background:var(--mw-bg);border:1px solid var(--mw-line);
  font-variant-numeric:tabular-nums;transition:transform .16s,background-color .16s}
.mw-chip:hover{background:var(--mw-bg-2)}
.mw-chip:active{transform:scale(.97)}
.mw-chip[aria-expanded=true] .mw-chev{transform:rotate(180deg)}
.mw-chip-ava{position:relative;width:28px;height:28px;flex-shrink:0}
.mw-chip-ava .mw-ava{width:28px;height:28px}
.mw-chip-wallet{position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border-radius:5px;background:var(--mw-bg);padding:1px;box-shadow:0 0 0 1.5px var(--mw-bg)}
.mw-chip-wallet img{width:100%;height:100%;border-radius:4px;object-fit:contain}
.mw-chip-bal{padding-left:9px;border-left:1px solid var(--mw-line);color:var(--mw-fg-3);font-weight:500}
.mw-chip.mw-sm{height:34px}
@media (max-width:480px){.mw-chip-bal{display:none}}
.mw-chip.mw-sm .mw-chip-ava,.mw-chip.mw-sm .mw-chip-ava .mw-ava{width:24px;height:24px}

.mw-menu{position:fixed;z-index:var(--mw-z,2147483000);width:264px;max-width:calc(100vw - 24px);padding:6px;border-radius:18px;
  background:var(--mw-bg);border:1px solid var(--mw-line);box-shadow:var(--mw-pop-shadow);transform-origin:100% 0}
.mw-menu-head{display:flex;align-items:center;gap:12px;padding:10px 10px 12px}
.mw-menu-ava{position:relative;width:40px;height:40px;flex-shrink:0}
.mw-menu-ava .mw-ava{width:40px;height:40px}
.mw-menu-ava .mw-chip-wallet{width:18px;height:18px;border-radius:6px;right:-3px;bottom:-3px;padding:2px}
.mw-menu-id{display:flex;flex-direction:column;gap:1px;min-width:0}
.mw-menu-addr{font-size:14.5px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.mw-menu-meta{font-size:12.5px;color:var(--mw-fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mw-menu-meta:empty{display:none}
.mw-menu-sep{height:1px;background:var(--mw-line);margin:0 8px 4px}
.mw-item{display:flex;align-items:center;gap:10px;width:100%;height:40px;padding:0 10px;border-radius:12px;font-size:14px;font-weight:500;transition:background-color .12s}
.mw-item:hover,.mw-item:focus-visible{background:var(--mw-bg-2);outline:none}
.mw-item svg{color:var(--mw-fg-3)}
.mw-item-danger{color:var(--mw-danger)}
.mw-item-danger svg{color:currentColor}
.mw-item-check{color:var(--mw-success)!important;animation:mw-pop 360ms var(--mw-spring) both}

.mw-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}

@media (prefers-reduced-motion:reduce){
  .mw-scope *,.mw-scope *::before,.mw-scope *::after{animation-duration:1ms!important;animation-iteration-count:1!important;animation-delay:0s!important;transition-duration:1ms!important}
  .mw-orbit-ring{animation:none!important;transform:rotate(200deg)}
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
