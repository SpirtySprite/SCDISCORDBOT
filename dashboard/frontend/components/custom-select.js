
(function() {
    let isUpdating = false;

    function updateCustomSelect(selectWrapper) {
        if (isUpdating) return;
        isUpdating = true;
        const select = selectWrapper.querySelector('select');
        if (!select) return;

        const selectedDiv = selectWrapper.querySelector('.select-selected');
        const itemsDiv = selectWrapper.querySelector('.select-items');

        if (!selectedDiv || !itemsDiv) {

            isUpdating = false;
            initCustomSelect(selectWrapper);
            return;
        }


        try {
            if (select.options && select.options.length > 0 && select.selectedIndex >= 0) {
                selectedDiv.innerHTML = select.options[select.selectedIndex].text || 'Select...';
            } else {
                selectedDiv.innerHTML = 'Select...';
            }
        } catch (e) {
            console.warn('Error updating select text:', e);
            selectedDiv.innerHTML = 'Select...';
        }


        itemsDiv.innerHTML = '';
        try {
            if (select.options && select.options.length > 0) {
                Array.from(select.options).forEach((option, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.textContent = option.text || option.value || '';
                    optionDiv.dataset.value = option.value || '';
                    if (index === select.selectedIndex) {
                        optionDiv.classList.add('same-as-selected');
                    }
                    optionDiv.addEventListener('click', function() {
                        try {
                            select.selectedIndex = index;
                            selectedDiv.innerHTML = option.text || option.value || '';
                            itemsDiv.querySelectorAll('div').forEach(div => {
                                div.classList.remove('same-as-selected');
                            });
                            this.classList.add('same-as-selected');
                            itemsDiv.classList.add('select-hide');
                            selectedDiv.classList.remove('select-arrow-active');


                            select.dispatchEvent(new Event('change', { bubbles: true }));
                        } catch (e) {
                            console.error('Error handling select option click:', e);
                        }
                    });
                    itemsDiv.appendChild(optionDiv);
                });
            }
        } catch (e) {
            console.error('Error updating select options:', e);
        } finally {
            isUpdating = false;
        }
    }

    function initCustomSelect(selectWrapper) {
        const select = selectWrapper.querySelector('select');
        if (!select) return;
        if (selectWrapper.classList.contains('custom-select-initialized')) {

            updateCustomSelect(selectWrapper);
            return;
        }

        selectWrapper.classList.add('custom-select-initialized');


        const selectedDiv = document.createElement('div');
        selectedDiv.className = 'select-selected';
        try {
            if (select.options && select.options.length > 0 && select.selectedIndex >= 0) {
                selectedDiv.innerHTML = select.options[select.selectedIndex].text || 'Select...';
            } else {
                selectedDiv.innerHTML = 'Select...';
            }
        } catch (e) {
            selectedDiv.innerHTML = 'Select...';
        }

        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'select-items select-hide';


        try {
            if (select.options && select.options.length > 0) {
                Array.from(select.options).forEach((option, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.textContent = option.text || option.value || '';
                    optionDiv.dataset.value = option.value || '';
                    if (index === select.selectedIndex) {
                        optionDiv.classList.add('same-as-selected');
                    }
                    optionDiv.addEventListener('click', function() {
                        try {
                            select.selectedIndex = index;
                            selectedDiv.innerHTML = option.text || option.value || '';
                            itemsDiv.querySelectorAll('div').forEach(div => {
                                div.classList.remove('same-as-selected');
                            });
                            this.classList.add('same-as-selected');
                            itemsDiv.classList.add('select-hide');
                            selectedDiv.classList.remove('select-arrow-active');


                            select.dispatchEvent(new Event('change', { bubbles: true }));
                        } catch (e) {
                            console.error('Error handling select option click:', e);
                        }
                    });
                    itemsDiv.appendChild(optionDiv);
                });
            }
        } catch (e) {
            console.error('Error creating select options:', e);
        }


        selectWrapper.insertBefore(selectedDiv, select);
        selectWrapper.appendChild(itemsDiv);


        selectedDiv.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllSelects(this);
            this.classList.toggle('select-arrow-active');
            itemsDiv.classList.toggle('select-hide');
        });
    }

    function initCustomSelects() {
        document.querySelectorAll('.custom-select').forEach(selectWrapper => {
            if (selectWrapper.classList.contains('custom-select-initialized')) {

                updateCustomSelect(selectWrapper);
            } else {

                initCustomSelect(selectWrapper);
            }
        });
    }

    function closeAllSelects(element) {
        const selects = document.querySelectorAll('.select-items');
        const selected = document.querySelectorAll('.select-selected');
        selects.forEach(item => {
            if (element && item.previousElementSibling !== element) {
                item.classList.add('select-hide');
            }
        });
        selected.forEach(item => {
            if (element && item !== element) {
                item.classList.remove('select-arrow-active');
            }
        });
    }


    document.addEventListener('click', closeAllSelects);


    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCustomSelects);
    } else {
        initCustomSelects();
    }


    window.initCustomSelects = initCustomSelects;


    window.updateCustomSelects = function() {
        if (isUpdating) return;
        document.querySelectorAll('.custom-select.custom-select-initialized').forEach(selectWrapper => {
            updateCustomSelect(selectWrapper);
        });
    };


    let observerTimeout = null;
    const observer = new MutationObserver((mutations) => {

        const hasNewNodes = mutations.some(mutation =>
            mutation.addedNodes.length > 0 &&
            Array.from(mutation.addedNodes).some(node =>
                node.nodeType === Node.ELEMENT_NODE &&
                (node.classList?.contains('custom-select') || node.querySelector?.('.custom-select'))
            )
        );

        if (hasNewNodes) {

            if (observerTimeout) {
                clearTimeout(observerTimeout);
            }
            observerTimeout = setTimeout(() => {
                initCustomSelects();
            }, 100);
        }
    });


    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributeFilter: []
    });
})();