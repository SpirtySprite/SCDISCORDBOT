
const button = {

    create(options = {}) {
        const btn = document.createElement('button');
        btn.className = `btn btn-${options.type || 'primary'} ${options.block ? 'btn-block' : ''}`;
        btn.innerHTML = `${options.icon ? `<i class="${options.icon}"></i> ` : ''}${options.text}`;
        if (options.onClick) btn.onclick = options.button;
        return btn;
    }
};
window.button = button;