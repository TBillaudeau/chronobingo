import React, { useEffect, useRef } from 'react';

const StarryBackground = ({ mode = 'light' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Prevent duplicate stars if re-rendered
    if (container.children.length > 10) return;

    const createStar = () => {
      const star = document.createElement('div');
      star.className = 'star';
      const size = Math.random() * 5 + 2;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDuration = `${Math.random() * 3 + 2}s`;
      container.appendChild(star);
    };

    for (let i = 0; i < 75; i++) {
      createStar();
    }
  }, []);

  return (
    <div className={`fixed -top-[50%] -left-[50%] w-[200%] h-[200%] min-h-screen z-0 overflow-hidden pointer-events-none ${mode === 'dark' ? 'bg-black' : 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900'}`}>
      <div ref={containerRef} className="absolute inset-0 opacity-50"></div>

      {/* Disco Lights effect - Only in Light Mode */}
      {mode !== 'dark' && (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[100px] mix-blend-screen animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }}></div>
        </>
      )}
      <style jsx global>{`
        @keyframes sparkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .star {
          position: absolute;
          background: white;
          border-radius: 50%;
          animation: sparkle 3s infinite ease-in-out;
        }
        .neon-text {
          text-shadow: 0 0 10px rgba(216, 180, 254, 0.5), 0 0 20px rgba(168, 85, 247, 0.3);
        }
        .glass-panel {
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
};

export default StarryBackground;