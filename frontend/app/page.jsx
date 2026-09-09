"use client";

import { useEffect, useRef, useState } from "react";
import RailflowLogo from "../components/RailflowLogo";

const GUIDES = {
  mandate: {
    title: "Your boundary, in plain words.",
    html: `<p>This illustrative mandate defines what the agent may do. Only you can approve a new boundary.</p><dl><dt>Capital deployed</dt><dd>Up to 70% of NAV</dd><dt>Illiquid sleeves</dt><dd>Up to 40%</dd><dt>Daily turnover</dt><dd>Up to 10%</dd><dt>Drawdown trigger</dt><dd>28%</dd><dt>Validity</dt><dd>30 days</dd></dl><p>This is a design preview. Wallet connection and on-chain signing are not enabled.</p>`,
  },
  sleeves: {
    title: "Four sleeves. One mandate.",
    html: `<p><strong>Lend:</strong> supply assets to lending pools. The example vault shows cirBTC at 1.85%, USDC at 6.20% and EURC at 4.20%.</p><p><strong>Swap:</strong> rotate between eligible assets within the mandate’s turnover limits.</p><p><strong>Yield:</strong> allocate to eligible yield strategies within your exposure limits.</p><p><strong>RWA:</strong> tokenised real-world assets. Not included in this illustrative vault yet.</p><p>Rates and allocations here are illustrative. T0 means instant liquidity, T1 pool liquidity, T2 a delay measured in days, and T3 a redemption window.</p>`,
  },
  security: {
    title: "Bounded by the architecture.",
    html: `<p>The proposed design keeps assets in a vault. The agent plans and executes eligible actions; it has no withdrawal path and cannot increase its own authority.</p><p>Each action is checked against the signed mandate. An action outside the limits reverts.</p><p>No verified deployment address was supplied for this preview, so contract explorer links are not available yet.</p>`,
  },
  withdraw: {
    title: "You keep the exit.",
    html: `<p>The product design allows you to revoke delegation at any time. Revocation stops new agent actions; the liquidity tier of each sleeve determines when its assets can be unwound.</p><p>T0: instant. T1: pool liquidity. T2: days. T3: a redemption window.</p><p>Withdrawal and emergency unwind controls will need to be connected to the deployed vault. This preview does not move funds.</p>`,
  },
  start: {
    title: "Start on Arc testnet.",
    html: `<p>1. Connect a compatible wallet to Arc testnet.</p><p>2. Fund it with test assets and review your mandate limits.</p><p>3. Approve the mandate and deposit test USDC to receive vault shares.</p><p>This landing page is a product preview. A live wallet connection, deployed contracts and testnet funding links have not been configured.</p>`,
  },
  log: {
    title: "Every decision has a reason.",
    html: `<p><strong>02:14 · Example decision</strong><br>Health factor: 1.61 → 2.30. Exposure reduced within the mandate.</p><p><strong>Example rejected action</strong><br>Turnover cap exceeded. The transaction reverts rather than exceeding the daily boundary.</p><p>The vault summary shows 1,847 illustrative logged decisions and 0 illustrative mandate breaches. A live activity feed is not connected.</p>`,
  },
};

export default function HomePage() {
  const [openGuide, setOpenGuide] = useState(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openGuide && !dialog.open) dialog.showModal();
    if (!openGuide && dialog.open) dialog.close();
  }, [openGuide]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setOpenGuide(null);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const handleBackdropClick = (event) => {
    const dialog = dialogRef.current;
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  };

  const guide = openGuide ? GUIDES[openGuide] : null;

  return (
    <div className="rf-page">
      <header className="rf-header">
        <a className="brand" href="#" aria-label="Railflow home">
          <RailflowLogo className="brand-icon" />
          Railflow<span className="brand-period">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#security">Security</a>
          <a href="#docs">Docs</a>
        </nav>
        <a className="button small" href="/lend">
          Enter app <span>↗</span>
        </a>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> AUTONOMY, SAFELY BOUNDED
            </p>
            <h1>
              DeFi that runs
              <br />
              while you <em>sleep.</em>
            </h1>
            <p className="intro">
              One signature sets the boundary. The agent supplies, swaps, rotates and rebalances on Arc, and can
              never step outside it.
            </p>
            <div className="actions">
              <a className="button" href="#mandate">
                Set your mandate <span>↗</span>
              </a>
              <a className="text-link" href="#vault">
                Explore the vault <span>↓</span>
              </a>
            </div>
            <div className="hero-note">
              <span className="shield">◇</span> Your assets. Your limits. Always.
            </div>
          </div>
          <div className="hero-aside">
            <div className="aside-label">
              <span>THE RAILFLOW PRINCIPLE</span>
              <span>01 — 04</span>
            </div>
            <div className="boundary">
              <div className="boundary-top">
                <span>YOUR BOUNDARY</span>
                <span>↗</span>
              </div>
              <div className="boundary-middle">
                <span className="orbit-mark">✳</span>
                <p>
                  Free to act.
                  <br />
                  <span>Bound to your rules.</span>
                </p>
              </div>
              <div className="boundary-bottom">
                <span>
                  <i /> Agent operating within mandate
                </span>
                <span>✓</span>
              </div>
            </div>
            <div className="aside-footer">
              <span>
                Powered by <strong>Arc</strong>
              </span>
              <span>Non-custodial by design</span>
            </div>
          </div>
        </section>

        <section className="vault-section wrap" id="vault">
          <div className="section-bar">
            <p className="eyebrow">YOUR CAPITAL, IN CONTEXT</p>
            <span className="demo-tag">Illustrative vault · demo data</span>
          </div>
          <div className="vault-grid">
            <article className="vault-card">
              <div className="card-heading">
                <h2>Vault overview</h2>
                <span className="active">
                  <i /> Agent active
                </span>
              </div>
              <div className="nav-value">
                <span>Net asset value</span>
                <strong>
                  $1,284,600<span>.00</span>
                </strong>
              </div>
              <div className="vault-metrics">
                <div>
                  <span>Net APY</span>
                  <strong className="green">
                    +5.12% <small>↗</small>
                  </strong>
                </div>
                <div>
                  <span>Drawdown / limit</span>
                  <strong>
                    6.2% <small>/ 28%</small>
                  </strong>
                </div>
              </div>
              <div className="progress-title">
                Mandate usage <span>Current / limit</span>
              </div>
              <div className="meter">
                <div>
                  <span>Capital deployed</span>
                  <span>
                    58 <b>/ 70%</b>
                  </span>
                </div>
                <progress value="58" max="70">
                  58 / 70%
                </progress>
              </div>
              <div className="meter">
                <div>
                  <span>Turnover today</span>
                  <span>
                    3.2 <b>/ 10%</b>
                  </span>
                </div>
                <progress value="3.2" max="10">
                  3.2 / 10%
                </progress>
              </div>
              <div className="meter">
                <div>
                  <span>Illiquid sleeves</span>
                  <span>
                    28 <b>/ 40%</b>
                  </span>
                </div>
                <progress value="28" max="40">
                  28 / 40%
                </progress>
              </div>
            </article>
            <article className="agent-card" id="mandate">
              <div className="agent-label">
                <span className="agent-symbol">✳</span>
                <span>RAILFLOW AGENT</span>
                <span className="pill">Preview</span>
              </div>
              <h2>
                Your mandate
                <br />
                is ready.
              </h2>
              <p>
                Deploy up to <strong>70% of NAV.</strong> Keep illiquid sleeves under <strong>40%.</strong> Reduce
                exposure if drawdown passes <strong>28%.</strong>
              </p>
              <div className="agent-rows">
                <div>
                  <span>Valid for</span>
                  <strong>30 days</strong>
                </div>
                <div>
                  <span>Signatures needed</span>
                  <strong>1</strong>
                </div>
              </div>
              <button className="button" onClick={() => setOpenGuide("mandate")}>
                Review mandate <span>↗</span>
              </button>
              <p className="small-note">One signature. A clearly defined boundary.</p>
            </article>
          </div>
          <div className="sleeves">
            <div className="sleeve-heading">
              <h3>Inside the vault</h3>
              <span>ASSET SLEEVES</span>
            </div>
            <div className="sleeve-row">
              <img className="asset-icon" src="/logos/cirbtc.svg" alt="" />
              <strong>cirBTC lending</strong>
              <span className="tier">
                T2 <span>· Days</span>
              </span>
              <span className="yield">1.85%</span>
              <span>↗</span>
            </div>
            <div className="sleeve-row">
              <img className="asset-icon" src="/logos/usdc.svg" alt="" />
              <strong>USDC lending</strong>
              <span className="tier">
                T1 <span>· Pool</span>
              </span>
              <span className="yield">6.20%</span>
              <span>↗</span>
            </div>
            <div className="sleeve-row">
              <img className="asset-icon" src="/logos/eurc.png" alt="" />
              <strong>EURC lending</strong>
              <span className="tier">
                T1 <span>· Pool</span>
              </span>
              <span className="yield">4.20%</span>
              <span>↗</span>
            </div>
            <button className="text-link" onClick={() => setOpenGuide("sleeves")}>
              View all sleeves <span>↗</span>
            </button>
          </div>
        </section>

        <section className="stats wrap" aria-label="Illustrative protocol metrics">
          <div>
            <strong>
              $1.28<span>M</span>
            </strong>
            <p>Vault TVL</p>
          </div>
          <div>
            <strong>1,847</strong>
            <p>Decisions logged</p>
          </div>
          <div>
            <strong>0</strong>
            <p>Mandate breaches</p>
          </div>
          <div>
            <strong>
              100<span>%</span>
            </strong>
            <p>Non-custodial</p>
          </div>
        </section>

        <section className="section wrap" id="product">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ONE BOUNDED LAYER</p>
              <h2>
                Everything the agent needs.
                <br />
                <span>Nothing it can abuse.</span>
              </h2>
            </div>
            <p>Four sleeves, one vault, one set of limits that lives on-chain and applies to every action.</p>
          </div>
          <div className="features">
            <article className="feature">
              <span className="feature-icon">↗</span>
              <p className="eyebrow">BOUNDED EXECUTION</p>
              <h3>
                Markets don’t wait
                <br />
                for your signature.
              </h3>
              <p>Sign-every-transaction sounds safer until your health factor drops at 3am and you’re asleep.</p>
              <div className="code success">
                <span>02:14</span> hf 1.61 → 2.30 <span>✓ within mandate</span>
              </div>
            </article>
            <article className="feature">
              <span className="feature-icon">⌘</span>
              <p className="eyebrow">ENFORCED BY CODE</p>
              <h3>
                Not won’t.
                <br />
                Can’t.
              </h3>
              <p>Limits are a contract, not a prompt. An action outside them reverts on-chain.</p>
              <div className="code error">
                × <span>revert</span> · turnover cap exceeded
              </div>
            </article>
            <article className="feature">
              <span className="feature-icon">⊞</span>
              <p className="eyebrow">UNIFIED WORKSPACE</p>
              <h3>
                Four sleeves.
                <br />
                One mandate.
              </h3>
              <div className="chips">
                <span>Lend</span>
                <span>Swap</span>
                <span>Yield</span>
                <span>RWA</span>
              </div>
            </article>
            <article className="feature">
              <span className="feature-icon">≋</span>
              <p className="eyebrow">LIQUIDITY LADDER</p>
              <h3>
                Know when
                <br />
                you can leave.
              </h3>
              <div className="ladder">
                <div>
                  <b>T0</b>
                  <span>Instant</span>
                </div>
                <div>
                  <b>T1</b>
                  <span>Pool</span>
                </div>
                <div>
                  <b>T2</b>
                  <span>Days</span>
                </div>
                <div>
                  <b>T3</b>
                  <span>Window</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="section steps-section" id="how-it-works">
          <div className="wrap">
            <p className="eyebrow">FROM BOUNDARY TO AUTONOMY</p>
            <div className="section-heading">
              <h2>
                A clear path
                <br />
                into delegation.
              </h2>
              <p>
                Four deliberate steps.
                <br />
                You hold the kill switch at every point.
              </p>
            </div>
            <div className="steps">
              <article>
                <span className="step-number">01</span>
                <h3>Set the mandate</h3>
                <p>Choose limits in plain language.</p>
              </article>
              <article>
                <span className="step-number">02</span>
                <h3>Deposit</h3>
                <p>USDC in, vault shares out.</p>
              </article>
              <article>
                <span className="step-number">03</span>
                <h3>It flies</h3>
                <p>The agent rotates capital for you.</p>
              </article>
              <article>
                <span className="step-number">04</span>
                <h3>Disengage</h3>
                <p>Revoke anytime, no reason needed.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section wrap" id="security">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SECURITY WITHOUT COMPROMISE</p>
              <h2>
                You set the boundary.
                <br />
                <span>Code enforces it.</span>
              </h2>
            </div>
            <p>The agent can read, plan and act. It cannot hold your money, widen its own limits, or stop you leaving.</p>
          </div>
          <div className="security-grid">
            <article>
              <span className="security-icon">◇</span>
              <h3>Never holds funds</h3>
              <p>Assets stay in the vault. The agent has no withdrawal path.</p>
              <button className="text-link" onClick={() => setOpenGuide("security")}>
                Explore the architecture ↗
              </button>
            </article>
            <article>
              <span className="security-icon">⊡</span>
              <h3>Limits live on-chain</h3>
              <p>Your mandate is a signed contract, not a setting.</p>
              <button className="text-link" onClick={() => setOpenGuide("mandate")}>
                Understand the mandate ↗
              </button>
            </article>
            <article>
              <span className="security-icon">↗</span>
              <h3>Withdraw without it</h3>
              <p>If the agent stops, anyone can unwind the vault.</p>
              <button className="text-link" onClick={() => setOpenGuide("withdraw")}>
                How withdrawals work ↗
              </button>
            </article>
          </div>
        </section>

        <section className="belief">
          <div className="wrap">
            <p className="eyebrow">OUR BELIEF</p>
            <blockquote>
              Delegation isn’t the risk.
              <br />
              <span>Unbounded delegation is.</span>
            </blockquote>
            <div className="belief-bottom">
              <span>Bounded autonomy. By design.</span>
              <a href="#mandate" className="button light">
                Set your mandate ↗
              </a>
            </div>
          </div>
        </section>

        <section className="section wrap" id="docs">
          <p className="eyebrow">KNOW WHAT YOU SIGNED</p>
          <h2>Find your way around.</h2>
          <div className="docs-grid">
            <button onClick={() => setOpenGuide("start")}>
              <span className="doc-number">
                01 <span>↗</span>
              </span>
              <h3>Start on Arc testnet</h3>
              <p>Connect, fund, first deposit.</p>
            </button>
            <button onClick={() => setOpenGuide("mandate")}>
              <span className="doc-number">
                02 <span>↗</span>
              </span>
              <h3>Understand your mandate</h3>
              <p>Every limit, in plain words.</p>
            </button>
            <button onClick={() => setOpenGuide("log")}>
              <span className="doc-number">
                03 <span>↗</span>
              </span>
              <h3>Read the decision log</h3>
              <p>Why it acted, why it didn’t.</p>
            </button>
          </div>
        </section>
      </main>

      <footer className="wrap">
        <div className="footer-main">
          <div>
            <a className="brand" href="#">
              <RailflowLogo className="brand-icon" />
              Railflow.
            </a>
            <p>
              Bounded autonomy on Arc.
              <br />
              Non-custodial DeFi software.
            </p>
          </div>
          <a className="button" href="#mandate">
            Set your mandate ↗
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Railflow</span>
          <span>Product preview · Illustrative data, no live transactions</span>
          <a href="#">Back to top ↑</a>
        </div>
      </footer>

      <dialog ref={dialogRef} className="guide-dialog" aria-labelledby="guide-title" onClick={handleBackdropClick}>
        <div className="dialog-top">
          <span className="eyebrow">RAILFLOW / PRODUCT PREVIEW</span>
          <button className="close-guide" aria-label="Close dialog" onClick={() => setOpenGuide(null)}>
            ×
          </button>
        </div>
        <h2 id="guide-title">{guide?.title}</h2>
        <div className="guide-content" dangerouslySetInnerHTML={{ __html: guide?.html || "" }} />
        <button className="button done-guide" onClick={() => setOpenGuide(null)}>
          Got it <span>✓</span>
        </button>
      </dialog>

      <style jsx>{`
        .rf-page {
          margin: 0;
          min-height: 100dvh;
          position: relative;
          isolation: isolate;
          background: #fff;
          color: var(--ink);
          font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
          --blue: #2045df;
          --ink: #171c2c;
          --muted: #697080;
          --line: #e3e6ee;
          --soft: #f6f7fa;
          --green: #238563;
          --action-gradient: linear-gradient(110deg, #2045df 0%, #2466cb 45%, #087b71 100%);
        }
        .rf-page * {
          box-sizing: border-box;
        }
        .rf-page button,
        .rf-page a {
          -webkit-tap-highlight-color: transparent;
        }
        .rf-page button {
          font: inherit;
          cursor: pointer;
          color: inherit;
        }
        .rf-page a {
          color: inherit;
          text-decoration: none;
        }
        .rf-page button:focus-visible,
        .rf-page a:focus-visible {
          outline: 3px solid #6c8dff;
          outline-offset: 5px;
        }
        .rf-page h1,
        .rf-page h2,
        .rf-page h3,
        .rf-page p {
          margin: 0;
        }
        .rf-page h1,
        .rf-page h2,
        .rf-page h3 {
          font-weight: 500;
          line-height: 1.15;
          letter-spacing: -0.045em;
        }
        .rf-page .wrap,
        .rf-page .rf-header {
          width: min(1184px, calc(100% - 96px));
          margin: auto;
        }
        .rf-page .rf-header {
          height: 104px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--line);
          gap: 24px;
        }
        .rf-page .brand {
          display: inline-flex;
          align-items: center;
          font-size: 27px;
          font-weight: 650;
          letter-spacing: -1.5px;
          line-height: 1;
        }
        .rf-page .brand-icon {
          display: block;
          width: 36px;
          height: 36px;
          margin-right: 10px;
          flex-shrink: 0;
        }
        .rf-page .brand-period {
          color: var(--blue);
        }
        .rf-page nav {
          display: flex;
          align-items: center;
          gap: 32px;
          padding: 10px 24px;
          border: 1px solid #d9deea;
          border-radius: 999px;
          font-size: 14px;
          color: #535969;
        }
        .rf-page nav a:hover,
        .rf-page .text-link:hover {
          color: var(--blue);
        }
        .rf-page .button {
          display: inline-flex;
          justify-content: space-between;
          align-items: center;
          gap: 28px;
          min-height: 52px;
          padding: 14px 22px;
          background: var(--blue);
          color: white;
          border: 1px solid var(--blue);
          border-radius: 7px;
          font-size: 14px;
          font-weight: 550;
          transition: background 0.18s, transform 0.18s;
        }
        .rf-page .button:hover {
          transform: translateY(-2px);
        }
        .rf-page .button.small {
          min-height: 42px;
          padding: 10px 17px;
        }
        .rf-page .hero {
          display: grid;
          grid-template-columns: 1.18fr 1fr;
          gap: 85px;
          padding-top: 86px;
          padding-bottom: 82px;
        }
        .rf-page .eyebrow {
          font: 600 11px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
          letter-spacing: 1.8px;
          color: var(--blue);
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .rf-page .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--blue);
        }
        .rf-page h1 {
          font-size: clamp(48px, 5.2vw, 72px);
          line-height: 1.07;
          letter-spacing: -4px;
          margin-top: 24px;
        }
        .rf-page h1 em {
          font-style: normal;
          color: var(--blue);
        }
        .rf-page .intro {
          font-size: 17px;
          line-height: 1.8;
          color: var(--muted);
          max-width: 450px;
          margin-top: 25px;
        }
        .rf-page .actions {
          display: flex;
          align-items: center;
          gap: 25px;
          margin-top: 30px;
        }
        .rf-page .text-link {
          display: inline-flex;
          align-items: center;
          gap: 20px;
          background: none;
          border: none;
          padding: 0;
          color: var(--blue);
          font-size: 14px;
          font-weight: 550;
          text-align: left;
        }
        .rf-page .hero-note {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 12px;
          color: var(--muted);
          margin-top: 25px;
        }
        .rf-page .shield {
          font-size: 20px;
          color: var(--blue);
        }
        .rf-page .hero-aside {
          align-self: center;
        }
        .rf-page .aside-label,
        .rf-page .aside-footer {
          display: flex;
          justify-content: space-between;
          color: #8a90a0;
          font: 10px ui-monospace, monospace;
          letter-spacing: 1px;
        }
        .rf-page .boundary {
          margin-top: 18px;
          border: 1px solid #9dafea;
          border-radius: 14px;
          padding: 23px;
          background: linear-gradient(145deg, #f8faff, #eaf0ff);
          box-shadow: 0 22px 55px -35px #697cb8;
        }
        .rf-page .boundary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--blue);
          font: 10px ui-monospace, monospace;
          letter-spacing: 1.5px;
        }
        .rf-page .boundary-top > span:last-child {
          font-size: 23px;
        }
        .rf-page .boundary-middle {
          padding: 25px 0 38px;
          text-align: center;
        }
        .rf-page .orbit-mark {
          display: block;
          font-size: 95px;
          line-height: 1.3;
          color: var(--blue);
          font-weight: 300;
        }
        .rf-page .boundary-middle p {
          font-size: 24px;
          letter-spacing: -0.8px;
          line-height: 1.35;
        }
        .rf-page .boundary-middle p span {
          color: #747f9e;
        }
        .rf-page .boundary-bottom {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #cad5f2;
          padding-top: 18px;
          font-size: 11px;
          color: #51617f;
        }
        .rf-page .boundary-bottom i,
        .rf-page .active i {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--green);
          margin-right: 6px;
        }
        .rf-page .aside-footer {
          margin-top: 21px;
          letter-spacing: 0;
          font-family: inherit;
          font-size: 11px;
        }
        .rf-page .aside-footer strong {
          font-size: 16px;
          font-weight: 600;
          color: var(--ink);
          margin-left: 4px;
        }
        .rf-page .section-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .rf-page .demo-tag {
          font-size: 11px;
          color: #7f8798;
        }
        .rf-page .vault-grid {
          display: grid;
          grid-template-columns: 1.45fr 1fr;
          gap: 22px;
        }
        .rf-page .vault-card {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 28px 32px;
        }
        .rf-page .card-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .rf-page .card-heading h2 {
          font-size: 17px;
          letter-spacing: -0.4px;
        }
        .rf-page .active {
          background: #edf7f1;
          color: var(--green);
          padding: 4px 9px;
          border-radius: 20px;
          font-size: 11px;
        }
        .rf-page .nav-value {
          margin-top: 24px;
        }
        .rf-page .nav-value > span,
        .rf-page .vault-metrics > div > span {
          display: block;
          font-size: 12px;
          color: var(--muted);
        }
        .rf-page .nav-value > strong {
          font-size: 39px;
          font-weight: 500;
          letter-spacing: -1.8px;
          line-height: 1.5;
        }
        .rf-page .nav-value strong span {
          color: #a8afbd;
          font-size: 26px;
        }
        .rf-page .vault-metrics {
          display: flex;
          gap: 60px;
          padding: 16px 0 23px;
          border-bottom: 1px solid var(--line);
        }
        .rf-page .vault-metrics strong {
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.6px;
        }
        .rf-page .vault-metrics small {
          font-size: 14px;
          color: var(--muted);
        }
        .rf-page .vault-metrics .green {
          color: var(--green);
        }
        .rf-page .progress-title {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-top: 21px;
          margin-bottom: 14px;
        }
        .rf-page .progress-title span {
          color: #9299a8;
          font-size: 11px;
        }
        .rf-page .meter {
          margin-top: 13px;
        }
        .rf-page .meter > div {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }
        .rf-page .meter b {
          font-weight: 400;
          color: #8d94a3;
        }
        .rf-page .meter progress {
          display: block;
          appearance: none;
          border: 0;
          width: 100%;
          height: 5px;
          border-radius: 5px;
          background: #eceff7;
          margin-top: 8px;
          overflow: hidden;
        }
        .rf-page .meter progress::-webkit-progress-bar {
          background: #eceff7;
        }
        .rf-page .meter progress::-webkit-progress-value {
          background: var(--blue);
          border-radius: 5px;
        }
        .rf-page .meter progress::-moz-progress-bar {
          background: var(--blue);
        }
        .rf-page .agent-card {
          border-radius: 12px;
          padding: 28px 32px;
          background: #f1f4fc;
          border: 1px solid #e5eaf8;
          scroll-margin-top: 24px;
        }
        .rf-page .agent-label {
          display: flex;
          align-items: center;
          gap: 9px;
          font: 10px ui-monospace, monospace;
          letter-spacing: 1px;
          color: var(--blue);
        }
        .rf-page .agent-symbol {
          font-size: 25px;
        }
        .rf-page .pill {
          margin-left: auto;
          border: 1px solid #d5ddf4;
          padding: 3px 7px;
          border-radius: 4px;
          font: 10px sans-serif;
          letter-spacing: 0;
        }
        .rf-page .agent-card h2 {
          font-size: 32px;
          margin: 22px 0 18px;
        }
        .rf-page .agent-card > p {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.8;
        }
        .rf-page .agent-card p strong {
          font-weight: 500;
          color: #3e4965;
        }
        .rf-page .agent-rows {
          margin: 22px 0;
        }
        .rf-page .agent-rows > div {
          display: flex;
          justify-content: space-between;
          padding: 9px 0;
          border-top: 1px solid #dce2f0;
          font-size: 12px;
        }
        .rf-page .agent-rows span {
          color: var(--muted);
        }
        .rf-page .agent-rows strong {
          font-weight: 500;
        }
        .rf-page .agent-card .button {
          width: 100%;
          min-height: 46px;
        }
        .rf-page .agent-card .small-note {
          text-align: center;
          font-size: 10px;
          margin-top: 10px;
        }
        .rf-page .sleeves {
          margin-top: 27px;
        }
        .rf-page .sleeve-heading {
          display: flex;
          justify-content: space-between;
          padding-bottom: 15px;
        }
        .rf-page .sleeve-heading h3 {
          font-size: 15px;
          letter-spacing: 0;
        }
        .rf-page .sleeve-heading > span {
          font: 10px ui-monospace, monospace;
          letter-spacing: 1px;
          color: #9299a8;
        }
        .rf-page .sleeve-row {
          display: grid;
          grid-template-columns: 32px 1fr 170px 100px 16px;
          gap: 14px;
          align-items: center;
          border-top: 1px solid var(--line);
          padding: 13px 0;
          font-size: 13px;
        }
        .rf-page .sleeve-row strong {
          font-weight: 500;
        }
        .rf-page .asset-icon {
          display: block;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: contain;
          flex-shrink: 0;
        }
        .rf-page .tier {
          color: #697080;
          font-size: 12px;
        }
        .rf-page .yield {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .rf-page .sleeve-row > span:last-child {
          color: #a0a7b6;
        }
        .rf-page .sleeves > .text-link {
          margin-top: 15px;
          font-size: 12px;
        }
        .rf-page .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          margin-top: 52px;
          padding: 32px 0;
        }
        .rf-page .stats > div {
          padding-left: 36px;
          border-left: 1px solid var(--line);
        }
        .rf-page .stats > div:first-child {
          padding-left: 0;
          border: 0;
        }
        .rf-page .stats strong {
          font-size: 39px;
          font-weight: 450;
          letter-spacing: -1.6px;
        }
        .rf-page .stats strong span {
          color: #8b94aa;
        }
        .rf-page .stats p {
          font-size: 12px;
          color: var(--muted);
          margin-top: 4px;
        }
        .rf-page .section {
          padding-top: 90px;
          padding-bottom: 85px;
        }
        .rf-page .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 40px;
          margin-bottom: 35px;
        }
        .rf-page .section h2 {
          font-size: 39px;
          line-height: 1.2;
        }
        .rf-page .section-heading .eyebrow {
          margin-bottom: 19px;
        }
        .rf-page .section-heading h2 span {
          color: #8a91a1;
        }
        .rf-page .section-heading > p {
          max-width: 310px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.8;
        }
        .rf-page .features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .rf-page .feature {
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 28px 30px;
          display: flex;
          flex-direction: column;
        }
        .rf-page .feature-icon {
          color: var(--blue);
          font-size: 26px;
          margin-bottom: 21px;
          line-height: 1;
        }
        .rf-page .feature .eyebrow {
          font-size: 10px;
          letter-spacing: 1.3px;
        }
        .rf-page .feature h3 {
          font-size: 28px;
          line-height: 1.2;
          margin: 13px 0;
        }
        .rf-page .feature > p:not(.eyebrow) {
          font-size: 14px;
          color: var(--muted);
          max-width: 390px;
          line-height: 1.8;
          margin-bottom: 24px;
        }
        .rf-page .code {
          margin-top: auto;
          padding: 12px;
          font: 11px/1.7 ui-monospace, monospace;
          border-radius: 5px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .rf-page .success {
          background: #f1f7f4;
          color: #3c7a62;
        }
        .rf-page .success > span:first-child {
          color: #94a99d;
        }
        .rf-page .success > span:last-child {
          margin-left: auto;
          font-size: 10px;
        }
        .rf-page .error {
          background: #fcf2f2;
          color: #b86262;
        }
        .rf-page .chips {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          flex-wrap: wrap;
        }
        .rf-page .chips span {
          border: 1px solid #dee3ef;
          border-radius: 5px;
          padding: 7px 20px;
          font-size: 13px;
          color: #596781;
        }
        .rf-page .ladder {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          margin-top: 19px;
          gap: 8px;
        }
        .rf-page .ladder > div {
          background: #f3f5fa;
          border-top: 2px solid #b9c6ef;
          padding: 10px;
          text-align: center;
        }
        .rf-page .ladder > div:nth-child(2) {
          border-color: #8ea4e9;
        }
        .rf-page .ladder > div:nth-child(3) {
          border-color: #587be2;
        }
        .rf-page .ladder > div:nth-child(4) {
          border-color: var(--blue);
        }
        .rf-page .ladder b {
          font: 13px ui-monospace, monospace;
          color: var(--blue);
          display: block;
        }
        .rf-page .ladder span {
          font-size: 11px;
          color: var(--muted);
        }
        .rf-page .steps-section {
          background: var(--soft);
          border-block: 1px solid var(--line);
          padding: 72px 0;
        }
        .rf-page .steps-section > .wrap > .eyebrow {
          margin-bottom: 18px;
        }
        .rf-page .steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          margin-top: 46px;
          gap: 30px;
        }
        .rf-page .steps article {
          border-top: 1px solid #ced5e3;
          padding-top: 20px;
        }
        .rf-page .step-number {
          font: 12px ui-monospace, monospace;
          color: var(--blue);
        }
        .rf-page .steps h3 {
          font-size: 19px;
          margin: 20px 0 10px;
          letter-spacing: -0.5px;
        }
        .rf-page .steps p {
          font-size: 13px;
          color: var(--muted);
          max-width: 180px;
        }
        .rf-page .security-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px;
          margin-top: 45px;
        }
        .rf-page .security-grid article {
          border-top: 1px solid var(--line);
          padding-top: 25px;
        }
        .rf-page .security-icon {
          font-size: 26px;
          color: var(--blue);
        }
        .rf-page .security-grid h3 {
          font-size: 22px;
          margin: 20px 0 13px;
        }
        .rf-page .security-grid p {
          font-size: 14px;
          color: var(--muted);
          line-height: 1.8;
          min-height: 75px;
          max-width: 310px;
        }
        .rf-page .security-grid .text-link {
          margin-top: 22px;
          font-size: 12px;
        }
        .rf-page .belief {
          background: #173bd3;
          color: #fff;
          padding: 62px 0;
        }
        .rf-page .belief .eyebrow {
          color: #aebfff;
        }
        .rf-page .belief blockquote {
          font-size: clamp(30px, 4vw, 52px);
          letter-spacing: -1.8px;
          line-height: 1.3;
          margin: 29px 0 38px;
          font-weight: 400;
        }
        .rf-page .belief blockquote span {
          color: #a5b8ff;
        }
        .rf-page .belief-bottom {
          border-top: 1px solid #4765dc;
          padding-top: 26px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .rf-page .belief-bottom > span {
          font-size: 12px;
          color: #becbff;
        }
        .rf-page .button.light {
          background: #fff;
          color: var(--blue);
          border-color: #fff;
        }
        .rf-page .docs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 30px;
        }
        .rf-page .docs-grid > button {
          padding: 24px;
          text-align: left;
          background: #f6f7fa;
          border: 1px solid transparent;
          border-radius: 8px;
          transition: border-color 0.2s;
        }
        .rf-page .docs-grid > button:hover {
          border-color: #8ca3ed;
        }
        .rf-page .doc-number {
          display: flex;
          justify-content: space-between;
          font: 11px ui-monospace, monospace;
          color: #8a92a2;
        }
        .rf-page .doc-number > span {
          color: var(--blue);
          font-size: 20px;
        }
        .rf-page .docs-grid h3 {
          font-size: 17px;
          letter-spacing: -0.4px;
          margin: 26px 0 10px;
        }
        .rf-page .docs-grid p {
          font-size: 12px;
          color: var(--muted);
        }
        .rf-page #docs > .eyebrow {
          margin-bottom: 18px;
        }
        .rf-page footer {
          border-top: 1px solid var(--line);
          padding: 40px 0 25px;
        }
        .rf-page .footer-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .rf-page .footer-main p {
          font-size: 12px;
          line-height: 1.8;
          color: var(--muted);
          margin-top: 17px;
        }
        .rf-page .footer-bottom {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          font-size: 10px;
          color: #9097a7;
          margin-top: 45px;
        }
        .rf-page .guide-dialog {
          max-width: 560px;
          width: calc(100% - 36px);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 30px;
          color: var(--ink);
          box-shadow: 0 25px 100px #11162e33;
        }
        .rf-page .guide-dialog::backdrop {
          background: #111c3a66;
          backdrop-filter: blur(5px);
        }
        .rf-page .dialog-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 25px;
        }
        .rf-page .dialog-top .eyebrow {
          font-size: 10px;
        }
        .rf-page .close-guide {
          border: 0;
          background: var(--soft);
          border-radius: 50%;
          width: 32px;
          height: 32px;
          font-size: 24px;
        }
        .rf-page .guide-dialog h2 {
          font-size: 30px;
          margin-bottom: 20px;
        }
        .rf-page .guide-content {
          color: var(--muted);
          font-size: 15px;
          line-height: 1.85;
        }
        .rf-page .guide-content :global(p) {
          margin-bottom: 15px;
        }
        .rf-page .guide-content :global(dl) {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 20px 0;
        }
        .rf-page .guide-content :global(dd) {
          margin: 0;
          color: var(--ink);
          text-align: right;
        }
        .rf-page .done-guide {
          margin-top: 20px;
          width: 100%;
        }
        @media (min-width: 1500px) {
          .rf-page .hero {
            padding-top: 110px;
            padding-bottom: 100px;
          }
        }
        @media (max-width: 1000px) {
          .rf-page .wrap,
          .rf-page .rf-header {
            width: calc(100% - 56px);
          }
          .rf-page .hero {
            gap: 35px;
            padding-top: 65px;
          }
          .rf-page h1 {
            font-size: 57px;
          }
          .rf-page .actions {
            gap: 16px;
            flex-wrap: wrap;
          }
          .rf-page .vault-card,
          .rf-page .agent-card {
            padding: 25px;
          }
          .rf-page .section h2 {
            font-size: 34px;
          }
          .rf-page .section-heading > p {
            max-width: 250px;
          }
          .rf-page .code {
            font-size: 10px;
          }
          .rf-page .chips span {
            padding: 7px 13px;
          }
        }
        @media (max-width: 720px) {
          .rf-page .wrap,
          .rf-page .rf-header {
            width: calc(100% - 36px);
          }
          .rf-page .rf-header {
            height: auto;
            min-height: 88px;
            flex-wrap: wrap;
            padding: 20px 0 15px;
            gap: 18px;
          }
          .rf-page .brand {
            font-size: 24px;
          }
          .rf-page .rf-header nav {
            order: 3;
            width: 100%;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 16px;
            font-size: 12px;
          }
          .rf-page .rf-header .small {
            padding: 8px 12px;
            min-height: 38px;
            font-size: 12px;
          }
          .rf-page .hero {
            grid-template-columns: 1fr;
            gap: 38px;
            padding-top: 45px;
            padding-bottom: 45px;
          }
          .rf-page h1 {
            font-size: clamp(43px, 10vw, 65px);
            letter-spacing: -2.7px;
          }
          .rf-page .intro {
            font-size: 16px;
          }
          .rf-page .hero-aside {
            max-width: 460px;
            width: 100%;
            margin: auto;
          }
          .rf-page .boundary-middle {
            padding: 14px 0 24px;
          }
          .rf-page .orbit-mark {
            font-size: 70px;
          }
          .rf-page .aside-label {
            font-size: 9px;
          }
          .rf-page .section-bar {
            gap: 10px;
            align-items: flex-start;
          }
          .rf-page .section-bar .eyebrow {
            font-size: 9px;
            letter-spacing: 1px;
          }
          .rf-page .demo-tag {
            font-size: 9px;
            text-align: right;
            max-width: 115px;
          }
          .rf-page .vault-grid {
            grid-template-columns: 1fr;
          }
          .rf-page .vault-card,
          .rf-page .agent-card {
            padding: 24px;
          }
          .rf-page .nav-value > strong {
            font-size: 35px;
          }
          .rf-page .sleeve-row {
            grid-template-columns: 28px 1fr 30px 55px;
            gap: 9px;
            font-size: 12px;
          }
          .rf-page .sleeve-row > span:last-child,
          .rf-page .tier span {
            display: none;
          }
          .rf-page .sleeve-heading > span {
            font-size: 9px;
          }
          .rf-page .stats {
            grid-template-columns: 1fr 1fr;
            row-gap: 27px;
            padding: 25px 0;
            margin-top: 35px;
          }
          .rf-page .stats > div {
            padding-left: 25px;
          }
          .rf-page .stats > div:nth-child(3) {
            border: 0;
            padding-left: 0;
          }
          .rf-page .stats strong {
            font-size: 34px;
          }
          .rf-page .section {
            padding: 55px 0;
          }
          .rf-page .section-heading {
            display: block;
            margin-bottom: 28px;
          }
          .rf-page .section h2 {
            font-size: 31px;
          }
          .rf-page .section-heading > p {
            max-width: 100%;
            margin-top: 20px;
          }
          .rf-page .features {
            grid-template-columns: 1fr;
          }
          .rf-page .feature {
            padding: 25px;
          }
          .rf-page .feature h3 {
            font-size: 27px;
          }
          .rf-page .feature > p:not(.eyebrow) {
            font-size: 15px;
          }
          .rf-page .steps {
            grid-template-columns: 1fr 1fr;
            gap: 28px 20px;
            margin-top: 28px;
          }
          .rf-page .steps h3 {
            font-size: 18px;
          }
          .rf-page .security-grid {
            grid-template-columns: 1fr;
            gap: 30px;
            margin-top: 30px;
          }
          .rf-page .security-grid p {
            min-height: 0;
            font-size: 15px;
            max-width: none;
          }
          .rf-page .security-grid h3 {
            margin-top: 12px;
          }
          .rf-page .security-grid .text-link {
            margin-top: 14px;
          }
          .rf-page .belief {
            padding: 40px 0;
          }
          .rf-page .belief blockquote {
            font-size: 32px;
            letter-spacing: -1px;
          }
          .rf-page .belief-bottom {
            align-items: flex-start;
            gap: 20px;
            flex-direction: column;
          }
          .rf-page .docs-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .rf-page .docs-grid h3 {
            font-size: 19px;
            margin-top: 13px;
          }
          .rf-page .docs-grid p {
            font-size: 14px;
          }
          .rf-page .footer-main {
            align-items: flex-start;
            gap: 25px;
            flex-direction: column;
          }
          .rf-page .footer-bottom {
            flex-wrap: wrap;
            margin-top: 30px;
            font-size: 10px;
          }
          .rf-page .footer-bottom > span:nth-child(2) {
            order: 3;
            width: 100%;
          }
          .rf-page .footer-bottom > a {
            margin-left: auto;
          }
          .rf-page .eyebrow {
            font-size: 10px;
          }
          .rf-page .active {
            font-size: 10px;
          }
          .rf-page .card-heading h2 {
            font-size: 16px;
          }
        }
        @media (min-width: 721px) and (max-width: 900px) {
          .rf-page .rf-header nav {
            gap: 18px;
            padding-inline: 18px;
          }
        }
        .rf-page .button,
        .rf-page .docs-grid > button,
        .rf-page .close-guide {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition: color 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
        }
        .rf-page .button::before,
        .rf-page .docs-grid > button::before,
        .rf-page .close-guide::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          border-radius: inherit;
          background: var(--action-gradient);
          opacity: 0;
          transition: opacity 0.22s ease;
          pointer-events: none;
        }
        .rf-page .button:is(:hover, :focus-visible),
        .rf-page .button.light:is(:hover, :focus-visible) {
          color: #fff;
          border-color: transparent;
          box-shadow: 0 6px 18px #2045df24;
        }
        .rf-page .button:is(:hover, :focus-visible)::before,
        .rf-page .docs-grid > button:is(:hover, :focus-visible)::before,
        .rf-page .close-guide:is(:hover, :focus-visible)::before {
          opacity: 1;
        }
        .rf-page .docs-grid > button:is(:hover, :focus-visible) {
          color: #fff;
          border-color: transparent;
          box-shadow: 0 6px 18px #2045df24;
        }
        .rf-page .docs-grid > button:is(:hover, :focus-visible) :is(p, .doc-number, .doc-number > span) {
          color: #fff;
        }
        .rf-page .docs-grid > button :is(p, .doc-number, .doc-number > span) {
          transition: color 0.22s ease;
        }
        .rf-page .text-link {
          border-radius: 4px;
          transition: background-color 0.22s ease, box-shadow 0.22s ease;
        }
        .rf-page .text-link:is(:hover, :focus-visible) {
          color: #1747b5;
          background: linear-gradient(110deg, #e9eeff, #dbf4ef);
          box-shadow: 0 0 0 6px #e9eeff;
        }
        .rf-page .close-guide:is(:hover, :focus-visible) {
          color: #fff;
        }
        @media (prefers-reduced-motion: reduce) {
          .rf-page .button::before,
          .rf-page .docs-grid > button::before,
          .rf-page .close-guide::before {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
