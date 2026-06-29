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
    initMapModal();

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
    updateSelectRouteButtonVisibility();
});

function initOrderForm() {
    const orderForm = document.getElementById('orderForm');
    if (!orderForm) return;

    orderForm.addEventListener('submit', async (event) => {
        event.preventDefault();

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
                document.getElementById('from').value = '';
                document.getElementById('to').value = '';
                updateSelectRouteButtonVisibility();
                updateShowOnMapButton();
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
            showNotification('Слишком длинное значение в поле', 'error');
            input.focus();
            return false;
        }
    }

    const phone = form.phone.value.trim();
    const phonePattern = /^[0-9+\-\s]+$/;
    if (!phonePattern.test(phone)) {
        showNotification('Телефон должен содержать только цифры, +, - и пробел', 'error');
        form.phone.focus();
        return false;
    }

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

let map, route, fromPoint, toPoint;
let modalMap, modalRoute, modalFromPoint, modalToPoint;
let modalMapInitialized = false;

function geocodeAddress(coords) {
    return ymaps.geocode(coords).then((res) => {
        const firstGeoObject = res.geoObjects.get(0);
        if (!firstGeoObject) {
            throw new Error('Адрес не найден');
        }
        return firstGeoObject.getAddressLine();
    });
}

function handleGeocodeError(error) {
    console.error('Ошибка геокодинга:', error);
    showNotification('Не удалось определить адрес, попробуйте вручную', 'error');
}

function updateShowOnMapButton() {
    const btn = document.getElementById('showOnMapBtn');
    if (!btn) return;
    const from = document.getElementById('from').value.trim();
    const to = document.getElementById('to').value.trim();
    btn.style.display = (from && to) ? 'block' : 'none';
}

function updateSelectRouteButtonVisibility() {
    const btn = document.getElementById('selectRouteBtn');
    const selectedBusInfo = document.getElementById('selectedBusInfo');
    if (!btn) return;
    const hasBus = selectedBusInfo && selectedBusInfo.innerHTML.trim().length > 0;
    btn.style.display = hasBus ? 'block' : 'none';
}

function addMarkerToMap(targetMap, coords, label) {
    const placemark = new ymaps.Placemark(coords, {
        iconContent: label
    }, {
        preset: 'islands#blackStretchyIcon'
    });
    targetMap.geoObjects.add(placemark);
}

function addMarker(coords, label) {
    addMarkerToMap(map, coords, label);
}

function clearMapState(targetMap, state) {
    if (state.route) {
        targetMap.geoObjects.remove(state.route);
        state.route = null;
    }
    targetMap.geoObjects.removeAll();
    state.fromPoint = null;
    state.toPoint = null;
}

function clearRoute() {
    if (!map) return;
    clearMapState(map, { route, fromPoint, toPoint });
    route = null;
    fromPoint = null;
    toPoint = null;
}

function handleMapClick(coords, state, targetMap, fromInput, toInput, options = {}) {
    const { onBothPointsSet, onReset } = options;

    if (!state.fromPoint) {
        state.fromPoint = coords;
        geocodeAddress(coords)
            .then((address) => {
                fromInput.value = address;
                addMarkerToMap(targetMap, coords, 'A');
            })
            .catch((error) => {
                handleGeocodeError(error);
                addMarkerToMap(targetMap, coords, 'A');
            });
    } else if (!state.toPoint) {
        state.toPoint = coords;
        geocodeAddress(coords)
            .then((address) => {
                toInput.value = address;
                addMarkerToMap(targetMap, coords, 'B');
                if (onBothPointsSet) onBothPointsSet();
            })
            .catch((error) => {
                handleGeocodeError(error);
                addMarkerToMap(targetMap, coords, 'B');
                if (onBothPointsSet) onBothPointsSet();
            });
    } else {
        clearMapState(targetMap, state);
        state.fromPoint = coords;
        state.toPoint = null;
        state.route = null;
        if (onReset) onReset();
        geocodeAddress(coords)
            .then((address) => {
                fromInput.value = address;
                toInput.value = '';
                addMarkerToMap(targetMap, coords, 'A');
            })
            .catch((error) => {
                handleGeocodeError(error);
                fromInput.value = '';
                toInput.value = '';
                addMarkerToMap(targetMap, coords, 'A');
            });
    }
}

function initYandexMaps() {
    if (typeof ymaps === 'undefined') {
        console.log('Яндекс Карты загружаются...');
        setTimeout(initYandexMaps, 1000);
        return;
    }

    ymaps.ready(() => {
        map = new ymaps.Map('map', {
            center: [44.9521, 34.1024],
            zoom: 9,
            controls: ['zoomControl', 'searchControl']
        });

        const fromInput = document.getElementById('from');
        const toInput = document.getElementById('to');
        const mapState = {
            get fromPoint() { return fromPoint; },
            set fromPoint(value) { fromPoint = value; },
            get toPoint() { return toPoint; },
            set toPoint(value) { toPoint = value; },
            get route() { return route; },
            set route(value) { route = value; }
        };

        map.events.add('click', (e) => {
            handleMapClick(
                e.get('coords'),
                mapState,
                map,
                fromInput,
                toInput,
                {
                    onBothPointsSet: () => {
                        document.getElementById('calculatePriceBtn').style.display = 'block';
                        updateShowOnMapButton();
                    },
                    onReset: () => {
                        document.getElementById('calculatePriceBtn').style.display = 'none';
                        document.getElementById('busSelectionGroup').style.display = 'none';
                        document.getElementById('priceCalculation').style.display = 'none';
                        updateShowOnMapButton();
                    }
                }
            );
        });

        fromInput.addEventListener('input', updateShowOnMapButton);
        toInput.addEventListener('input', updateShowOnMapButton);

        document.getElementById('calculatePriceBtn').addEventListener('click', () => {
            calculateRoute();
            document.getElementById('busSelectionGroup').style.display = 'block';
            document.getElementById('priceCalculation').style.display = 'block';
            document.getElementById('calculatePriceBtn').style.display = 'none';
            updateShowOnMapButton();
        });
    });
}

function calculateRoute() {
    if (!fromPoint || !toPoint) return;

    ymaps.route([fromPoint, toPoint], {
        mapStateAutoApply: true,
        avoidTrafficJams: false
    }).then((res) => {
        route = res;
        map.geoObjects.add(route);

        const distance = res.getLength() / 1000;
        document.getElementById('calculatedDistance').textContent = distance.toFixed(1);
        updatePrice(distance);
    }).catch((err) => {
        console.error('Ошибка построения маршрута:', err);
        showNotification('Не удалось построить маршрут. Попробуйте выбрать другие точки.', 'error');
    });
}

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

function initPriceCalculation() {
    const busSelect = document.getElementById('busSelect');
    busSelect.addEventListener('change', () => updatePrice());

    const showOnMapBtn = document.getElementById('showOnMapBtn');
    if (showOnMapBtn) {
        showOnMapBtn.addEventListener('click', () => {
            const from = document.getElementById('from').value.trim();
            const to = document.getElementById('to').value.trim();

            if (from && to) {
                const url = `https://yandex.ru/maps/?rtext=~${encodeURIComponent(from)}~${encodeURIComponent(to)}&rtt=auto`;
                window.open(url, '_blank');
            } else {
                showNotification('Заполните поля "Откуда" и "Куда"', 'error');
            }
        });
    }

    // Обработка кнопки "Выбрать маршрут"
    const selectRouteBtn = document.getElementById('selectRouteBtn');
    if (selectRouteBtn) {
        selectRouteBtn.addEventListener('click', () => {
            openMapModal();
        });
    }
}

// Modal Map Logic
let modalMap, modalRoute, modalFromPoint, modalToPoint;

function initMapModal() {
    const modal = document.getElementById('mapModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const applyBtn = document.getElementById('modalApplyBtn');
    const calculateBtn = document.getElementById('modalCalculateBtn');

    if (!modal) return;

    // Close modal
    closeBtn.addEventListener('click', closeMapModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeMapModal();
    });

    // Apply route
    applyBtn.addEventListener('click', () => {
        const from = document.getElementById('modalFrom').value.trim();
        const to = document.getElementById('modalTo').value.trim();

        if (from && to) {
            document.getElementById('from').value = from;
            document.getElementById('to').value = to;
            closeMapModal();
            showNotification('Маршрут применён', 'success');
        } else {
            showNotification('Выберите маршрут на карте', 'error');
        }
    });

    // Calculate route in modal
    calculateBtn.addEventListener('click', () => {
        calculateModalRoute();
    });
}

function openMapModal() {
    const modal = document.getElementById('mapModal');
    modal.style.display = 'flex';

    // Initialize modal map if not already done
    if (!modalMap && typeof ymaps !== 'undefined') {
        ymaps.ready(() => {
            modalMap = new ymaps.Map('modalMap', {
                center: [44.9521, 34.1024],
                zoom: 9,
                controls: ['zoomControl', 'searchControl']
            });

            // Handle clicks on modal map
            modalMap.events.add('click', (e) => {
                const coords = e.get('coords');
                const fromInput = document.getElementById('modalFrom');
                const toInput = document.getElementById('modalTo');

                if (!modalFromPoint) {
                    modalFromPoint = coords;
                    ymaps.geocode(coords).then((res) => {
                        const firstGeoObject = res.geoObjects.get(0);
                        fromInput.value = firstGeoObject.getAddressLine();
                        addModalMarker(coords, 'A');
                    });
                } else if (!modalToPoint) {
                    modalToPoint = coords;
                    ymaps.geocode(coords).then((res) => {
                        const firstGeoObject = res.geoObjects.get(0);
                        toInput.value = firstGeoObject.getAddressLine();
                        addModalMarker(coords, 'B');
                        document.getElementById('modalCalculateBtn').style.display = 'block';
                    });
                } else {
                    clearModalRoute();
                    modalFromPoint = coords;
                    ymaps.geocode(coords).then((res) => {
                        const firstGeoObject = res.geoObjects.get(0);
                        fromInput.value = firstGeoObject.getAddressLine();
                        addModalMarker(coords, 'A');
                    });
                }
            });
        });
    }
}

function closeMapModal() {
    const modal = document.getElementById('mapModal');
    modal.style.display = 'none';
    clearModalRoute();
}

function addModalMarker(coords, label) {
    const placemark = new ymaps.Placemark(coords, {
        iconContent: label
    }, {
        preset: 'islands#blackStretchyIcon'
    });
    modalMap.geoObjects.add(placemark);
}

function clearModalRoute() {
    if (modalRoute) {
        modalMap.geoObjects.remove(modalRoute);
        modalRoute = null;
    }
    modalMap.geoObjects.removeAll();
    modalFromPoint = null;
    modalToPoint = null;
    document.getElementById('modalFrom').value = '';
    document.getElementById('modalTo').value = '';
    document.getElementById('modalCalculateBtn').style.display = 'none';
    document.getElementById('modalPriceCalculation').style.display = 'none';
    document.getElementById('modalApplyBtn').style.display = 'none';
}

function calculateModalRoute() {
    if (!modalFromPoint || !modalToPoint) return;

    ymaps.route([modalFromPoint, modalToPoint], {
        mapStateAutoApply: true,
        avoidTrafficJams: false
    }).then((res) => {
        modalRoute = res;
        modalMap.geoObjects.add(modalRoute);

        const distance = res.getLength() / 1000;
        document.getElementById('modalCalculatedDistance').textContent = distance.toFixed(1);
        document.getElementById('modalPriceCalculation').style.display = 'block';
        document.getElementById('modalApplyBtn').style.display = 'block';
    }).catch((err) => {
        console.error('Ошибка построения маршрута в модалке:', err);
        showNotification('Не удалось построить маршрут', 'error');
    });
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

function initRouteItems() {
    const routeItems = document.querySelectorAll('.route-item');
    routeItems.forEach(item => {
        item.addEventListener('click', async () => {
            const from = item.dataset.from;
            const to = item.dataset.to;

            if (from && to) {
                document.getElementById('from').value = from;
                document.getElementById('to').value = to;
                clearRoute();
                updateShowOnMapButton();

                if (typeof ymaps === 'undefined') return;

                try {
                    const fromResult = await ymaps.geocode(from);
                    const toResult = await ymaps.geocode(to);

                    const fromGeo = fromResult.geoObjects.get(0);
                    const toGeo = toResult.geoObjects.get(0);
                    if (!fromGeo || !toGeo) {
                        throw new Error('Адрес не найден');
                    }

                    fromPoint = fromGeo.geometry.getCoordinates();
                    toPoint = toGeo.geometry.getCoordinates();

                    addMarker(fromPoint, 'A');
                    addMarker(toPoint, 'B');

                    calculateRoute();
                    document.getElementById('busSelectionGroup').style.display = 'block';
                    document.getElementById('priceCalculation').style.display = 'block';
                } catch (error) {
                    handleGeocodeError(error);
                }
            } else {
                clearRoute();
                document.getElementById('from').value = '';
                document.getElementById('to').value = '';
                document.getElementById('busSelectionGroup').style.display = 'none';
                document.getElementById('priceCalculation').style.display = 'none';
                document.getElementById('calculatePriceBtn').style.display = 'none';
                updateShowOnMapButton();
            }
        });
    });
}

function initModalMap() {
    if (modalMapInitialized || typeof ymaps === 'undefined') return;

    modalMap = new ymaps.Map('modalMap', {
        center: [44.9521, 34.1024],
        zoom: 9,
        controls: ['zoomControl', 'searchControl']
    });

    const fromInput = document.getElementById('modalFrom');
    const toInput = document.getElementById('modalTo');
    const modalState = {
        get fromPoint() { return modalFromPoint; },
        set fromPoint(value) { modalFromPoint = value; },
        get toPoint() { return modalToPoint; },
        set toPoint(value) { modalToPoint = value; },
        get route() { return modalRoute; },
        set route(value) { modalRoute = value; }
    };

    modalMap.events.add('click', (e) => {
        handleMapClick(
            e.get('coords'),
            modalState,
            modalMap,
            fromInput,
            toInput,
            {
                onBothPointsSet: () => {
                    document.getElementById('modalCalculateBtn').style.display = 'block';
                    document.getElementById('modalApplyBtn').style.display = 'block';
                },
                onReset: () => {
                    document.getElementById('modalCalculateBtn').style.display = 'none';
                    document.getElementById('modalPriceCalculation').style.display = 'none';
                    document.getElementById('modalApplyBtn').style.display = 'none';
                }
            }
        );
    });

    modalMapInitialized = true;
}

function calculateModalRoute() {
    if (!modalFromPoint || !modalToPoint) return;

    ymaps.route([modalFromPoint, modalToPoint], {
        mapStateAutoApply: true,
        avoidTrafficJams: false
    }).then((res) => {
        if (modalRoute) {
            modalMap.geoObjects.remove(modalRoute);
        }
        modalRoute = res;
        modalMap.geoObjects.add(modalRoute);

        const distance = res.getLength() / 1000;
        document.getElementById('modalCalculatedDistance').textContent = distance.toFixed(1);
        document.getElementById('modalPriceCalculation').style.display = 'block';
        document.getElementById('modalApplyBtn').style.display = 'block';
    }).catch((err) => {
        console.error('Ошибка построения маршрута:', err);
        showNotification('Не удалось построить маршрут. Попробуйте выбрать другие точки.', 'error');
    });
}

function resetModalMap() {
    if (modalMap) {
        clearMapState(modalMap, { route: modalRoute, fromPoint: modalFromPoint, toPoint: modalToPoint });
    }
    modalRoute = null;
    modalFromPoint = null;
    modalToPoint = null;

    document.getElementById('modalFrom').value = '';
    document.getElementById('modalTo').value = '';
    document.getElementById('modalCalculateBtn').style.display = 'none';
    document.getElementById('modalPriceCalculation').style.display = 'none';
    document.getElementById('modalApplyBtn').style.display = 'none';
    document.getElementById('modalCalculatedDistance').textContent = '0';
}

function syncMainMapFromFields(from, to) {
    document.getElementById('from').value = from;
    document.getElementById('to').value = to;
    document.getElementById('formFrom').value = from;
    document.getElementById('formTo').value = to;
    updateShowOnMapButton();

    if (typeof ymaps === 'undefined' || !map) return;

    clearRoute();
    Promise.all([ymaps.geocode(from), ymaps.geocode(to)])
        .then(([fromResult, toResult) => {
            const fromGeo = fromResult.geoObjects.get(0);
            const toGeo = toResult.geoObjects.get(0);
            if (!fromGeo || !toGeo) {
                throw new Error('Адрес не найден');
            }

            fromPoint = fromGeo.geometry.getCoordinates();
            toPoint = toGeo.geometry.getCoordinates();
            addMarker(fromPoint, 'A');
            addMarker(toPoint, 'B');
            calculateRoute();
            document.getElementById('busSelectionGroup').style.display = 'block';
            document.getElementById('priceCalculation').style.display = 'block';
        })
        .catch((error) => {
            handleGeocodeError(error);
        });
}

function initMapModal() {
    const selectRouteBtn = document.getElementById('selectRouteBtn');
    const mapModal = document.getElementById('mapModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalApplyBtn = document.getElementById('modalApplyBtn');
    const modalCalculateBtn = document.getElementById('modalCalculateBtn');

    if (!selectRouteBtn || !mapModal) return;

    selectRouteBtn.style.display = 'none';

    const closeModal = () => {
        mapModal.style.display = 'none';
        document.body.style.overflow = '';
    };

    selectRouteBtn.addEventListener('click', () => {
        resetModalMap();
        mapModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        if (typeof ymaps !== 'undefined') {
            ymaps.ready(() => {
                initModalMap();
                if (modalMap) {
                    modalMap.container.fitToViewport();
                }
            });
        }
    });

    closeModalBtn.addEventListener('click', closeModal);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);
    mapModal.addEventListener('click', (e) => {
        if (e.target === mapModal) closeModal();
    });

    modalCalculateBtn.addEventListener('click', calculateModalRoute);

    modalApplyBtn.addEventListener('click', () => {
        const from = document.getElementById('modalFrom').value.trim();
        const to = document.getElementById('modalTo').value.trim();

        if (!from || !to) {
            showNotification('Выберите обе точки маршрута', 'error');
            return;
        }

        syncMainMapFromFields(from, to);
        closeModal();
    });
}
