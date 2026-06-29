document.addEventListener('DOMContentLoaded', () => {
    initOrderForm();
    initScrollAnimations();
    initSmoothScroll();
    initNavbarEffects();
    initFloatingIcons();
    initYandexMaps();
    loadBuses();
    initPriceCalculation();
    initRouteItems();

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

        // Копируем значения из полей карты в скрытые поля формы
        const fromValue = document.getElementById('from').value.trim();
        const toValue = document.getElementById('to').value.trim();
        document.getElementById('formFrom').value = fromValue;
        document.getElementById('formTo').value = toValue;

        if (!validateForm(orderForm)) return;

        const submitBtn = orderForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Отправка...';
        submitBtn.disabled = true;

        try {
            const formData = {
                name: orderForm.name.value.trim(),
                phone: orderForm.phone.value.trim(),
                from: fromValue,
                to: toValue,
                distance: document.getElementById('calculatedDistance').textContent.trim(),
                date: orderForm.date.value.trim(),
                time: orderForm.time.value.trim(),
                passengers: orderForm.passengers.value,
                request: orderForm.request.value.trim(),
                busId: document.getElementById('busSelect').value || null
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
                // Очищаем поля карты
                document.getElementById('from').value = '';
                document.getElementById('to').value = '';
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
        { name: 'date', maxLength: 20 },
        { name: 'time', maxLength: 10 },
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

    // Валидация телефона
    const phone = form.phone.value.trim();
    const phonePattern = /^[0-9+\-\s]+$/;
    if (!phonePattern.test(phone)) {
        showNotification('Телефон должен содержать только цифры, +, - и пробел', 'error');
        form.phone.focus();
        return false;
    }

    // Валидация полей from и to (скрытые поля в форме)
    const from = form.from.value.trim();
    const to = form.to.value.trim();

    if (from.length > 100) {
        showNotification('Слишком длинное значение в поле "Откуда"', 'error');
        document.getElementById('from').focus();
        return false;
    }

    if (to.length > 100) {
        showNotification('Слишком длинное значение в поле "Куда"', 'error');
        document.getElementById('to').focus();
        return false;
    }

    if (!form.name.value.trim() || !form.phone.value.trim() ||
        !from || !to ||
        !form.date.value.trim() || !form.time.value.trim()) {
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

// Инициализация Яндекс Карт
let map, route, fromPoint, toPoint;

function initYandexMaps() {
    if (typeof ymaps === 'undefined') {
        console.log('Яндекс Карты загружаются...');
        setTimeout(initYandexMaps, 1000);
        return;
    }

    ymaps.ready(() => {
        map = new ymaps.Map('map', {
            center: [44.9521, 34.1024], // Крым
            zoom: 9,
            controls: ['zoomControl', 'searchControl']
        });

        // Обработка кликов на карте
        map.events.add('click', (e) => {
            const coords = e.get('coords');
            const fromInput = document.getElementById('from');
            const toInput = document.getElementById('to');

            if (!fromPoint) {
                fromPoint = coords;
                ymaps.geocode(coords).then((res) => {
                    const firstGeoObject = res.geoObjects.get(0);
                    fromInput.value = firstGeoObject.getAddressLine();
                    addMarker(coords, 'A');
                });
            } else if (!toPoint) {
                toPoint = coords;
                ymaps.geocode(coords).then((res) => {
                    const firstGeoObject = res.geoObjects.get(0);
                    toInput.value = firstGeoObject.getAddressLine();
                    addMarker(coords, 'B');
                    // Показываем кнопку "Рассчитать стоимость"
                    document.getElementById('calculatePriceBtn').style.display = 'block';
                });
            } else {
                // Сброс и установка новой точки А
                clearRoute();
                fromPoint = coords;
                ymaps.geoocode(coords).then((res) => {
                    const firstGeoObject = res.geoObjects.get(0);
                    fromInput.value = firstGeoObject.getAddressLine();
                    addMarker(coords, 'A');
                });
            }
        });

        // Обработка кнопки "Рассчитать стоимость"
        document.getElementById('calculatePriceBtn').addEventListener('click', () => {
            calculateRoute();
            document.getElementById('busSelectionGroup').style.display = 'block';
            document.getElementById('priceCalculation').style.display = 'block';
            document.getElementById('calculatePriceBtn').style.display = 'none';
        });
    });
}

function addMarker(coords, label) {
    const placemark = new ymaps.Placemark(coords, {
        iconContent: label
    }, {
        preset: 'islands#blackStretchyIcon'
    });
    map.geoObjects.add(placemark);
}

function clearRoute() {
    if (route) {
        map.geoObjects.remove(route);
        route = null;
    }
    map.geoObjects.removeAll();
    fromPoint = null;
    toPoint = null;
}

function calculateRoute() {
    if (!fromPoint || !toPoint) return;

    ymaps.route([fromPoint, toPoint], {
        mapStateAutoApply: true,
        avoidTrafficJams: false
    }).then((res) => {
        route = res;
        map.geoObjects.add(route);

        // Получаем длину маршрута в метрах
        const distance = res.getLength() / 1000; // в километрах
        document.getElementById('calculatedDistance').textContent = distance.toFixed(1);
        updatePrice(distance);

        console.log('Расстояние маршрута:', distance.toFixed(1), 'км');
    }).catch((err) => {
        console.error('Ошибка построения маршрута:', err);
        showNotification('Не удалось построить маршрут. Попробуйте выбрать другие точки.', 'error');
    });
}

// Загрузка автобусов из API
async function loadBuses() {
    try {
        const response = await fetch('/api/buses');
        const buses = await response.json();
        const busSelect = document.getElementById('busSelect');

        buses.forEach(bus => {
            const option = document.createElement('option');
            option.value = bus.id;
            option.textContent = `${bus.name} (${bus.seats} мест) - ${bus.price_per_km} ₽/км`;
            option.dataset.price = bus.price_per_km;
            busSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки автобусов:', error);
    }
}

// Инициализация расчета стоимости
function initPriceCalculation() {
    const busSelect = document.getElementById('busSelect');
    busSelect.addEventListener('change', () => updatePrice());
}

function updatePrice(distance = null) {
    const calculatedDistance = distance || parseFloat(document.getElementById('calculatedDistance').textContent) || 0;
    const busSelect = document.getElementById('busSelect');
    const selectedOption = busSelect.options[busSelect.selectedIndex];

    if (selectedOption && selectedOption.dataset.price) {
        const pricePerKm = parseFloat(selectedOption.dataset.price);
        const totalPrice = calculatedDistance * pricePerKm;
        document.getElementById('estimatedPrice').textContent = totalPrice.toFixed(0);
    }
}

// Инициализация кликабельных маршрутов
function initRouteItems() {
    const routeItems = document.querySelectorAll('.route-item');
    routeItems.forEach(item => {
        item.addEventListener('click', async () => {
            const from = item.dataset.from;
            const to = item.dataset.to;

            if (from && to) {
                // Заполняем поля
                document.getElementById('from').value = from;
                document.getElementById('to').value = to;

                // Сбрасываем предыдущий маршрут
                clearRoute();

                // Получаем координаты через геокодинг
                try {
                    const fromResult = await ymaps.geocode(from);
                    const toResult = await ymaps.geocode(to);

                    const fromCoords = fromResult.geoObjects.get(0).geometry.getCoordinates();
                    const toCoords = toResult.geoObjects.get(0).geometry.getCoordinates();

                    fromPoint = fromCoords;
                    toPoint = toCoords;

                    addMarker(fromCoords, 'A');
                    addMarker(toCoords, 'B');

                    // Строим маршрут и показываем кнопку расчета
                    calculateRoute();
                    document.getElementById('busSelectionGroup').style.display = 'block';
                    document.getElementById('priceCalculation').style.display = 'block';
                } catch (error) {
                    console.error('Ошибка геокодинга:', error);
                    showNotification('Не удалось найти адреса на карте', 'error');
                }
            } else {
                // Для "Свой маршрут" просто сбрасываем
                clearRoute();
                document.getElementById('from').value = '';
                document.getElementById('to').value = '';
                document.getElementById('busSelectionGroup').style.display = 'none';
                document.getElementById('priceCalculation').style.display = 'none';
                document.getElementById('calculatePriceBtn').style.display = 'none';
            }
        });
    });
}