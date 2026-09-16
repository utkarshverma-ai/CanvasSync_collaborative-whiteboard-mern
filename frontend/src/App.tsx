
import React, { useState, useEffect } from 'react';
import CanvasSyncLogo from './components/CanvasSyncLogo';
import Whiteboard from './components/Whiteboard';
import LandingSections from './components/LandingSections';

const App: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isJoined, setIsJoined] = useState(false);
  const isJoiningExistingBoard = Boolean(roomId);

  useEffect(() => {
    // Check for room ID in URL hash for simplicity in this demo environment
    const hash = window.location.hash.substring(1);
    if (hash) {
      setRoomId(hash);
    }
  }, []);

  useEffect(() => {
    if (isJoined) return;

    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      revealTargets.forEach(target => target.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14 });

    revealTargets.forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, [isJoined]);

  const scrollToEntryForm = () => {
    document.getElementById('entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const scrollToTop = () => {
    document.querySelector<HTMLElement>('.entry-page')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      const id = roomId || Math.random().toString(36).substring(2, 9);
      setRoomId(id);
      window.location.hash = id;
      setIsJoined(true);
    }
  };

  if (!isJoined) {
    return (
      <main className="entry-page">
        <div className="entry-background-mark entry-background-mark--left" aria-hidden="true"></div>
        <div className="entry-background-mark entry-background-mark--right" aria-hidden="true"></div>

        <div className="entry-layout">
          <header className="entry-topbar entry-reveal entry-reveal--header">
            <CanvasSyncLogo className="entry-topbar-brand" size={52} showWordmark />
            <p className="entry-reassurance" aria-label="Real-time collaboration, private rooms, no sign-up required">
              <span>Real-time</span><b aria-hidden="true">•</b><span>Private rooms</span><b aria-hidden="true">•</b><span>No sign-up required</span>
            </p>
          </header>

          <section className="entry-story" aria-labelledby="entry-heading">
            <div className="entry-copy">
              <p className="entry-product-name entry-reveal entry-reveal--copy">CanvasSync</p>
              <h1 id="entry-heading" className="entry-reveal entry-reveal--heading">
                Sketch together.<br />
                <em>Think in the same space.</em>
              </h1>
              <p className="entry-description entry-reveal entry-reveal--description">
                A lightweight, real-time whiteboard for designers, developers and teams.
              </p>
            </div>

            <ul className="entry-benefits entry-reveal entry-reveal--benefits" aria-label="CanvasSync benefits">
              <li>
                <span className="entry-benefit-icon entry-benefit-icon--sage" aria-hidden="true"><i className="fa-solid fa-users"></i></span>
                <span>Real-time<br />collaboration</span>
              </li>
              <li>
                <span className="entry-benefit-icon entry-benefit-icon--sand" aria-hidden="true"><i className="fa-solid fa-lock"></i></span>
                <span>Private<br />rooms</span>
              </li>
              <li>
                <span className="entry-benefit-icon entry-benefit-icon--peach" aria-hidden="true"><i className="fa-solid fa-bolt"></i></span>
                <span>No sign-up<br />required</span>
              </li>
            </ul>

            <div className="entry-preview entry-reveal entry-reveal--preview" aria-label="An example collaborative CanvasSync whiteboard">
              <div className="entry-preview-window-dots" aria-hidden="true"><i></i><i></i><i></i></div>
              <div className="entry-preview-toolbar" aria-hidden="true">
                <i className="fa-solid fa-arrow-pointer"></i>
                <i className="fa-solid fa-pen"></i>
                <i className="fa-regular fa-note-sticky"></i>
                <i className="fa-regular fa-circle"></i>
              </div>
              <div className="entry-preview-presence" aria-hidden="true"><span>U</span><span>T</span><b>+2</b></div>
              <p className="entry-preview-note">Ideas flow<br />better together.</p>
              <div className="entry-preview-sticky">Good<br />ideas<br />here!</div>
              <div className="entry-preview-idea" aria-hidden="true"><i className="fa-regular fa-lightbulb"></i></div>
              <svg className="entry-preview-sketch" viewBox="0 0 580 315" fill="none" aria-hidden="true">
                <path className="sketch-line sketch-line--one" d="M109 116 C162 99 207 103 244 114" />
                <path className="sketch-line sketch-line--two" d="M332 200 C356 205 383 196 409 174" />
                <path className="sketch-line sketch-line--three" d="M301 255 L342 201 L372 255 L397 226 L438 274 L468 238 L505 278" />
                <path className="sketch-line sketch-line--four" d="M269 82 C269 54 294 37 323 37 C354 37 374 56 374 83 C374 115 350 135 322 136 C292 136 269 114 269 82Z" />
                <path className="sketch-line sketch-line--five" d="M411 174 L404 178 M409 174 L406 166" />
              </svg>
              <div className="entry-preview-circle-label">Build<br />Create<br />Share</div>
              <div className="entry-preview-cursor entry-preview-cursor--one" aria-hidden="true"><i className="fa-solid fa-caret-up"></i><span>Utkarsh</span></div>
              <div className="entry-preview-cursor entry-preview-cursor--two" aria-hidden="true"><i className="fa-solid fa-caret-up"></i><span>Tejashwi</span></div>
            </div>
          </section>

          <section id="entry-form" className="entry-surface entry-reveal entry-reveal--form" aria-labelledby="join-heading">
            <p className="entry-eyebrow">Join the canvas</p>
            <h2 id="join-heading">{isJoiningExistingBoard ? 'Join the canvas' : 'Start a shared board'}</h2>
            <p className="entry-form-description">Enter your name, choose a room — or create a new one — and start drawing together.</p>

            <form onSubmit={handleJoin} className="entry-form">
              <div className="entry-field">
                <label htmlFor="user-name">Your name</label>
                <input
                  id="user-name"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Utkarsh"
                  className="entry-input"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="entry-field">
                <label htmlFor="room-id">Room ID <span>(optional)</span></label>
                <input
                  id="room-id"
                  type="text"
                  value={roomId || ''}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter a room ID"
                  className="entry-input"
                />
                <p className={`entry-field-help ${isJoiningExistingBoard ? 'is-joining' : ''}`}>
                  {isJoiningExistingBoard ? 'You’re joining an existing board.' : 'Leave blank to create a new board.'}
                </p>
              </div>
              <button type="submit" className="entry-submit">
                <span>{isJoiningExistingBoard ? 'Join board' : 'Create board'}</span>
                <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            </form>

            <div className="entry-or" aria-hidden="true"><span></span>or<span></span></div>
            <div className="entry-shared-room-helper">
              <span className="entry-shared-room-icon" aria-hidden="true"><i className="fa-solid fa-users"></i></span>
              <p><strong>Joining a shared room?</strong><span>Paste the room ID you were given and start collaborating instantly.</span></p>
            </div>
            <p className="entry-footer">Share the invite link once you’re inside.</p>
          </section>
          <LandingSections onStartBoard={scrollToEntryForm} onBackToTop={scrollToTop} />
        </div>
      </main>
    );
  }

  return <Whiteboard roomId={roomId!} userName={userName} />;
};

export default App;
