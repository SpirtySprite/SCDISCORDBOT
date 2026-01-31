const modal = {
    show(options = {}) {
        const {
            title = 'Confirmation',
            content = '',
            confirmText = 'Confirmer',
            cancelText = 'Annuler',
            onConfirm = () => {},
            onCancel = () => {}
        } = options;

        const container = document.getElementById('modal-container');
        if (!container) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';

        modalOverlay.innerHTML = `
            <div class="modal-content card">
                <h3>${title}</h3>
                <div class="modal-body mb-1">${content}</div>
                <div class="modal-footer flex justify-end gap-1">
                    <button class="btn btn-secondary modal-cancel">${cancelText}</button>
                    <button class="btn btn-primary modal-confirm">${confirmText}</button>
                </div>
            </div>
        `;

        container.appendChild(modalOverlay);


        setTimeout(() => {
            if (window.initCustomSelects) {
                window.initCustomSelects();
            }
        }, 100);

        const close = () => {
            modalOverlay.style.opacity = '0';
            setTimeout(() => modalOverlay.remove(), 300);
        };

        modalOverlay.querySelector('.modal-cancel').onclick = () => {
            onCancel();
            close();
        };

        const confirmBtn = modalOverlay.querySelector('.modal-confirm');
        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                await onConfirm();
                close();
            } catch (e) {
                confirmBtn.disabled = false;
                confirmBtn.innerText = confirmText;
            }
        };


        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) close();
        };
    }
};

const modalStyle = document.createElement('style');
modalStyle.textContent = `
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3000;
        transition: var(--transition);
        backdrop-filter: blur(4px);
    }
    .modal-content {
        width: 100%;
        max-width: 500px;
        transform: translateY(0);
        animation: modalIn 0.3s ease-out;
    }
    @keyframes modalIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
`;
document.head.appendChild(modalStyle);

window.modal = modal;