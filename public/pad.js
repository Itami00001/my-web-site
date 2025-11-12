document.addEventListener('DOMContentLoaded', () => {
    initOrderForm();
    initScrollAnimations();
    initSmoothScroll();
    initNavbarEffects();
    initFloatingIcons();
    
    // Проверяем, был ли выбран автобус
    const selectedBus = localStorage.getItem('selectedBus');
    if (selectedBus) {
        const bus = JSON.parse(selectedBus);
        document.getElementById('selectedBusInfo').innerHTML = `
            <div class="selected-bus-info">
                <h4>✅ Выбран автобус:</h4>
                <p><strong>${bus.name}</strong> (${bus.seats} мест) - ${bus.price_per_hour} ₽/час</p>
                <input type="hidden" name="busId" value="${bus.id}">
            </div>
        `;
        localStorage.removeItem('selectedBus');
    }
});

function initOrderForm() {
    const orderForm = document.getElementById('orderForm');
    if (!orderForm) return;

    orderForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!validateForm(orderForm)) return;

        const submitBtn = orderForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Отправка...';
        submitBtn.disabled = true;

        try {
            const formData = {
                name: orderForm.name.value.trim(),
                phone: orderForm.phone.value.trim(),
                from: orderForm.from.value.trim(),
                to: orderForm.to.value.trim(),
                dateTime: orderForm.dateTime.value.trim(),
                passengers: orderForm.passengers.value,
                request: orderForm.request.value.trim(),
                busId: orderForm.busId ? orderForm.busId.value : null
            };

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                showNotification(data.message, 'success');
                orderForm.reset();
                document.getElementById('selectedBusInfo').innerHTML = '';
            } else {
                throw new Error(data.error || 'Ошибка сервера');
            }

        } catch (error) {
            console.error('Ошибка:', error);
            showNotification(error.message, 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

function validateForm(form) {
    const fields = [
        { name: 'name', maxLength: 100 },
        { name: 'phone', maxLength: 20 },
        { name: 'from', maxLength: 100 },
        { name: 'to', maxLength: 100 },
        { name: 'dateTime', maxLength: 50 },
        { name: 'passengers', maxLength: 3 },
        { name: 'request', maxLength: 300 }
    ];

    for (const field of fields) {
        const input = form[field.name];
        if (input && input.value.length > field.maxLength) {
            showNotification(`Слишком длинное значение в поле`, 'error');
            input.focus();
            return false;
        }
    }

    if (!form.name.value.trim() || !form.phone.value.trim() || 
        !form.from.value.trim() || !form.to.value.trim()) {
        showNotification('Заполните все обязательные поля', 'error');
        return false;
    }

    return true;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✓' : '!'}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);

    const autoClose = setTimeout(() => {
        closeNotification(notification);
    }, 5000);

    notification.querySelector('.notification-close').addEventListener('click', () => {
        clearTimeout(autoClose);
        closeNotification(notification);
    });
}

function closeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
}

function initScrollAnimations() {
    const hiddenElements = document.querySelectorAll('.hidden');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('appear');
            }
        });
    });

    hiddenElements.forEach((element) => {
        observer.observe(element);
    });
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
            }
        });
    });
}

function initNavbarEffects() {
    const nav = document.querySelector('nav');
    if (!nav) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            nav.style.background = 'rgba(255, 255, 255, 0.95)';
            nav.style.backdropFilter = 'blur(10px)';
        } else {
            nav.style.background = 'white';
            nav.style.backdropFilter = 'none';
        }
    });
}

function initFloatingIcons() {
    const floatingIcons = document.querySelector('.floating-icons');
    if (floatingIcons) {
        setTimeout(() => {
            floatingIcons.style.transform = 'scale(1.1)';
            setTimeout(() => floatingIcons.style.transform = 'scale(1)', 300);
        }, 2000);
    }
}