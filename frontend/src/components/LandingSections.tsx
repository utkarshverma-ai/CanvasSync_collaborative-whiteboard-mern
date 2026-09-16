import React from 'react';
import CanvasSyncLogo from './CanvasSyncLogo';

interface LandingSectionsProps {
  onStartBoard: () => void;
  onBackToTop: () => void;
}

const LandingSections: React.FC<LandingSectionsProps> = ({ onStartBoard, onBackToTop }) => (
  <>
    <section className="landing-section landing-why" aria-labelledby="why-heading" data-reveal>
      <div className="landing-section-intro">
        <p className="landing-eyebrow">Why CanvasSync</p>
        <h2 id="why-heading">Ideas move faster when everyone can see them.</h2>
        <p>CanvasSync keeps collaboration lightweight — open a room, share the link, and start sketching together in real time.</p>
      </div>
      <div className="landing-capabilities">
        <article className="landing-capability" data-reveal>
          <span>01</span>
          <h3>Draw together</h3>
          <p>See strokes appear across connected clients in real time.</p>
        </article>
        <article className="landing-capability" data-reveal>
          <span>02</span>
          <h3>Share instantly</h3>
          <p>Create a room and invite collaborators with a simple link.</p>
        </article>
        <article className="landing-capability" data-reveal>
          <span>03</span>
          <h3>Stay in sync</h3>
          <p>Collaborative undo and redo keep every participant on the same board state.</p>
        </article>
      </div>
    </section>

    <section className="landing-section landing-steps" aria-labelledby="steps-heading" data-reveal>
      <div className="landing-section-intro landing-section-intro--centered">
        <p className="landing-eyebrow">How it works</p>
        <h2 id="steps-heading">From idea to shared canvas in seconds.</h2>
      </div>
      <div className="landing-steps-path" aria-hidden="true">
        <svg viewBox="0 0 980 84" fill="none" preserveAspectRatio="none">
          <path d="M35 51 C180 11 278 78 425 43 S673 15 945 44" />
        </svg>
      </div>
      <ol className="landing-steps-list">
        <li data-reveal>
          <span>01</span>
          <h3>Create or join</h3>
          <p>Enter your name and start a new room — or paste an existing room ID.</p>
        </li>
        <li data-reveal>
          <span>02</span>
          <h3>Share the room</h3>
          <p>Send the invite link to whoever you want on the board.</p>
        </li>
        <li data-reveal>
          <span>03</span>
          <h3>Draw together</h3>
          <p>Sketch, erase, undo and redo while everyone stays synchronized.</p>
        </li>
      </ol>
    </section>

    <section className="landing-section landing-product" aria-labelledby="product-heading" data-reveal>
      <div className="landing-section-intro">
        <p className="landing-eyebrow">Built for the moment ideas start moving</p>
        <h2 id="product-heading">A whiteboard that stays out of the way.</h2>
      </div>
      <div className="landing-product-stage">
        <aside className="landing-product-callout landing-product-callout--presence" data-reveal>
          <i className="fa-solid fa-users" aria-hidden="true"></i>
          <strong>Live presence</strong>
          <span>See who’s currently working on the board.</span>
        </aside>
        <div className="landing-workspace-preview" aria-label="A representation of the CanvasSync workspace">
          <div className="landing-workspace-header">
            <div className="landing-workspace-brand"><CanvasSyncLogo size={38} decorative /><span>CanvasSync</span><small>Board · ideas-48</small></div>
            <div className="landing-workspace-actions"><span className="landing-connected"><b></b>Connected</span><span className="landing-workspace-avatars"><i>U</i><i>T</i><i>S</i></span><button type="button"><i className="fa-solid fa-share-nodes" aria-hidden="true"></i> Share</button></div>
          </div>
          <div className="landing-workspace-canvas">
            <svg viewBox="0 0 920 450" fill="none" aria-hidden="true">
              <path className="workspace-sketch workspace-sketch--one" d="M159 205 C244 154 304 179 374 202 S501 236 578 162" />
              <path className="workspace-sketch workspace-sketch--two" d="M317 331 L386 252 L440 336 L488 287 L550 356 L618 285 L699 348" />
              <path className="workspace-sketch workspace-sketch--three" d="M638 104 C682 75 728 86 748 119 C765 147 744 177 703 180 C665 183 635 153 638 104Z" />
            </svg>
            <p className="landing-workspace-note">Map the next<br />good idea.</p>
            <div className="landing-workspace-sticky">Try this<br />together</div>
            <div className="landing-workspace-circle">Build<br />on it</div>
            <span className="landing-workspace-cursor landing-workspace-cursor--one"><i className="fa-solid fa-caret-up" aria-hidden="true"></i>Utkarsh</span>
            <span className="landing-workspace-cursor landing-workspace-cursor--two"><i className="fa-solid fa-caret-up" aria-hidden="true"></i>Tejashwi</span>
          </div>
          <div className="landing-workspace-toolbar" aria-hidden="true">
            <i className="fa-solid fa-pen"></i><i className="fa-solid fa-eraser"></i><span></span><b></b><i className="fa-solid fa-arrow-rotate-left"></i><i className="fa-solid fa-arrow-rotate-right"></i><span></span><i className="fa-solid fa-download"></i>
          </div>
        </div>
        <aside className="landing-product-callout landing-product-callout--history" data-reveal>
          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
          <strong>Server-confirmed history</strong>
          <span>Collaborative undo and redo keep clients synchronized.</span>
        </aside>
        <aside className="landing-product-callout landing-product-callout--sharing" data-reveal>
          <i className="fa-solid fa-link" aria-hidden="true"></i>
          <strong>Shareable rooms</strong>
          <span>Send a link and begin collaborating.</span>
        </aside>
      </div>
    </section>

    <section className="landing-section landing-engineering" aria-labelledby="engineering-heading" data-reveal>
      <div className="landing-section-intro">
        <p className="landing-eyebrow">Under the canvas</p>
        <h2 id="engineering-heading">Simple on the surface.<br /><em>Careful underneath.</em></h2>
        <p>CanvasSync is designed around synchronized realtime state, small focused frontend responsibilities, and a server-authoritative collaboration model.</p>
      </div>
      <dl className="landing-engineering-list">
        <div><dt>Realtime</dt><dd>Socket.IO room synchronization</dd></div>
        <div><dt>Frontend</dt><dd>React + TypeScript + Vite</dd></div>
        <div><dt>Backend</dt><dd>Node.js + Express + TypeScript</dd></div>
        <div><dt>State</dt><dd>Server-authoritative drawing history</dd></div>
        <div><dt>Quality</dt><dd>Integration-tested collaboration behavior</dd></div>
        <div><dt>Security</dt><dd>Validated realtime payloads and room membership</dd></div>
      </dl>
    </section>

    <section className="landing-final-cta" aria-labelledby="final-cta-heading" data-reveal>
      <p className="landing-eyebrow">Ready when the idea is</p>
      <h2 id="final-cta-heading">Got an idea?<br />Put it on the canvas.</h2>
      <p>Create a room, share the link, and start drawing together.</p>
      <button type="button" onClick={onStartBoard}>Start a board <i className="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
      <small>No sign-up required.</small>
    </section>

    <footer className="landing-footer">
      <div className="landing-footer-main">
        <div className="landing-footer-brand"><CanvasSyncLogo size={42} showWordmark /><p>Real-time ideas, drawn together.</p></div>
        <div className="landing-footer-maker"><span>Designed &amp; built by</span><strong>Utkarsh Verma</strong><p>Full-Stack Developer</p></div>
        <nav className="landing-footer-links" aria-label="Developer profiles">
          <a href="https://github.com/utkarshverma-ai" target="_blank" rel="noopener noreferrer" aria-label="Utkarsh Verma on GitHub">GitHub <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
          <a href="https://www.linkedin.com/in/utkarsh-verma-ooo1" target="_blank" rel="noopener noreferrer" aria-label="Utkarsh Verma on LinkedIn">LinkedIn <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
          <a href="https://utkarshportfolio-three.vercel.app/" target="_blank" rel="noopener noreferrer" aria-label="Utkarsh Verma portfolio">Portfolio <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
        </nav>
      </div>
      <div className="landing-footer-bottom"><span>© 2026 Utkarsh Verma</span><button type="button" onClick={onBackToTop}>Back to top <i className="fa-solid fa-arrow-up" aria-hidden="true"></i></button></div>
    </footer>
  </>
);

export default LandingSections;
