export class Titlebar {
    render() {
        const titleBar = document.createElement('div');
        titleBar.id = 'title-bar';
        titleBar.innerHTML = `
            <div class="title-bar-nav">
                <button id="back-btn" class="nav-btn">
                    <svg viewBox="0 0 16 16"><path d="M10.9,13.9c-0.2,0.2-0.5,0.2-0.7,0l-5.6-5.6c-0.2-0.2-0.2-0.5,0-0.7l5.6-5.6c0.2-0.2,0.5-0.2,0.7,0s0.2,0.5,0,0.7L5.7,8 l5.2,5.2C11.1,13.4,11.1,13.7,10.9,13.9z"></path></svg>
                </button>
                <button id="forward-btn" class="nav-btn">
                    <svg viewBox="0 0 16 16"><path d="M5.1,13.9c0.2,0.2,0.5,0.2,0.7,0l5.6-5.6c0.2-0.2,0.2-0.5,0-0.7L5.8,2.1c-0.2-0.2-0.5-0.2-0.7,0s-0.2,0.5,0,0.7L10.3,8 l-5.2,5.2C4.9,13.4,4.9,13.7,5.1,13.9z"></path></svg>
                </button>
                <button id="reload-btn" class="nav-btn">
                    <svg viewBox="0 0 16 16"><path d="M13.6,2.4C12.2,1,10.2,0,8,0C3.6,0,0,3.6,0,8s3.6,8,8,8c3.4,0,6.3-2.2,7.5-5.2c0.1-0.3-0.1-0.6-0.4-0.8 c-0.3-0.1-0.6,0.1-0.8,0.4C13.4,11.6,10.9,14,8,14c-3.3,0-6-2.7-6-6s2.7-6,6-6c1.7,0,3.3,0.8,4.4,2.1l-2.1,2.1c-0.2,0.2-0.2,0.5,0,0.7 C10.4,8.9,10.5,9,10.7,9H15c0.6,0,1-0.4,1-1V3.3c0-0.3-0.1-0.4-0.3-0.5c-0.2-0.2-0.5-0.1-0.7,0.1L13.6,2.4z"></path></svg>
                </button>
            </div>
            <div class="window-controls">
                <button id="minimize-btn">
                    <svg x="0px" y="0px" viewBox="0 0 10.2 1"><rect x="0" y="0" width="10.2" height="1"></rect></svg>
                </button>
                <button id="maximize-btn">
                    <svg viewBox="0 0 10 10"><path d="M0,0v10h10V0H0z M9,9H1V1h8V9z"></path></svg>
                </button>
                <button id="close-btn">
                    <svg viewBox="0 0 10 10"><polygon points="10.2,0.7 9.5,0 5.1,4.4 0.7,0 0,0.7 4.4,5.1 0,9.5 0.7,10.2 5.1,5.8 9.5,10.2 10.2,9.5 5.8,5.1"></polygon></svg>
                </button>
            </div>
        `;

        const minimizeBtn = titleBar.querySelector('#minimize-btn');
        const maximizeBtn = titleBar.querySelector('#maximize-btn');
        const closeBtn = titleBar.querySelector('#close-btn');

        minimizeBtn.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });

        maximizeBtn.addEventListener('click', () => {
            window.electronAPI.maximizeWindow();
        });

        closeBtn.addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });
        
        window.electronAPI.onSetDraggable((isDraggable) => {
            if (isDraggable) {
                titleBar.classList.add('draggable');
            } else {
                titleBar.classList.remove('draggable');
            }
        });

        return titleBar;
    }
}