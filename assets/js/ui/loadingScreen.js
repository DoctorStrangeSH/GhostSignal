class LoadingScreen {
    constructor() {
        this._create();
    }
    
    _create() {
        const overlay = document.createElement('div');
        overlay.id = 'loading-screen';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--bg-primary);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: opacity 0.5s ease;
            font-family: var(--font-mono);
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center;">
                <pre style="color: var(--accent-green); font-size: 12px; line-height: 1; text-shadow: var(--text-glow);">
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
  ██║  ███╗███████║██║   ██║███████╗   ██║   
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║   
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
                </pre>
                <pre style="color: var(--accent-green); font-size: 10px; opacity: 0.8;">
   ███████╗██╗ ██████╗ ███╗   ██╗ █████╗ ██╗     
   ██╔════╝██║██╔════╝ ████╗  ██║██╔══██╗██║     
   ███████╗██║██║  ███╗██╔██╗ ██║███████║██║     
   ╚════██║██║██║   ██║██║╚██╗██║██╔══██║██║     
   ███████║██║╚██████╔╝██║ ╚████║██║  ██║███████╗
   ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
                </pre>
            </div>
            <div style="margin-top: 24px; color: var(--text-dim); font-size: 12px;">
                <span id="loading-text">ИНИЦИАЛИЗАЦИЯ ТЕРМИНАЛА</span>
                <span class="blinking-cursor" style="color: var(--accent-green);">_</span>
            </div>
            <div style="margin-top: 16px; width: 200px; height: 2px; background: var(--border-color);">
                <div id="loading-bar" style="height: 100%; background: var(--accent-green); width: 0%; transition: width 0.3s;"></div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.overlay = overlay;
        this.bar = overlay.querySelector('#loading-bar');
        this.text = overlay.querySelector('#loading-text');
    }
    
    setProgress(percent, message) {
        if (this.bar) this.bar.style.width = percent + '%';
        if (this.text && message) this.text.textContent = message;
    }
    
    hide() {
        if (this.overlay) {
            this.overlay.style.opacity = '0';
            setTimeout(() => {
                this.overlay?.remove();
            }, 500);
        }
    }
}