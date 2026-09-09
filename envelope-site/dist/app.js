const guides = {
 mandate: { title: 'Your boundary, in plain words.', content: '<p>This illustrative mandate defines what the agent may do. Only you can approve a new boundary.</p><dl><dt>Capital deployed</dt><dd>Up to 70% of NAV</dd><dt>Illiquid sleeves</dt><dd>Up to 40%</dd><dt>Daily turnover</dt><dd>Up to 10%</dd><dt>Drawdown trigger</dt><dd>28%</dd><dt>Validity</dt><dd>30 days</dd></dl><p>This is a design preview. Wallet connection and on-chain signing are not enabled.</p>' },
 sleeves: { title: 'Four sleeves. One mandate.', content: '<p><strong>Lend:</strong> supply assets to lending pools. The example vault shows USDC at 6.20% and EURC at 4.20%.</p><p><strong>Swap:</strong> rotate between eligible assets within the mandate’s turnover limits.</p><p><strong>Yield:</strong> allocate to eligible yield strategies within your exposure limits.</p><p><strong>RWA:</strong> tokenised real-world assets, including T-bills. The example shows 4.80% with T3 withdrawal windows.</p><p>Rates and allocations here are illustrative. T0 means instant liquidity, T1 pool liquidity, T2 a delay measured in days, and T3 a redemption window.</p>' },
 security: { title: 'Bounded by the architecture.', content: '<p>The proposed design keeps assets in a vault. The agent plans and executes eligible actions; it has no withdrawal path and cannot increase its own authority.</p><p>Each action is checked against the signed mandate. An action outside the limits reverts.</p><p>No verified deployment address was supplied for this preview, so contract explorer links are not available yet.</p>' },
 withdraw: { title: 'You keep the exit.', content: '<p>The product design allows you to revoke delegation at any time. Revocation stops new agent actions; the liquidity tier of each sleeve determines when its assets can be unwound.</p><p>T0: instant. T1: pool liquidity. T2: days. T3: a redemption window.</p><p>Withdrawal and emergency unwind controls will need to be connected to the deployed vault. This preview does not move funds.</p>' },
 start: { title: 'Start on Arc testnet.', content: '<p>1. Connect a compatible wallet to Arc testnet.</p><p>2. Fund it with test assets and review your mandate limits.</p><p>3. Approve the mandate and deposit test USDC to receive vault shares.</p><p>This landing page is a product preview. A live wallet connection, deployed contracts and testnet funding links have not been configured.</p>' },
 log: { title: 'Every decision has a reason.', content: '<p><strong>02:14 · Example decision</strong><br>Health factor: 1.61 → 2.30. Exposure reduced within the mandate.</p><p><strong>Example rejected action</strong><br>Turnover cap exceeded. The transaction reverts rather than exceeding the daily boundary.</p><p>The vault summary shows 1,847 illustrative logged decisions and 0 illustrative mandate breaches. A live activity feed is not connected.</p>' }
};
const dialog = document.querySelector('#guide');
dialog.setAttribute('aria-labelledby', 'guide-title');
document.querySelectorAll('[data-guide]').forEach(button => button.addEventListener('click', () => {
 const guide = guides[button.dataset.guide];
 document.querySelector('#guide-title').textContent = guide.title;
 document.querySelector('#guide-content').innerHTML = guide.content;
 dialog.showModal();
}));
document.querySelector('#close-guide').addEventListener('click', () => dialog.close());
document.querySelector('#done-guide').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
