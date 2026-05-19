const API_BASE = "http://localhost:3000/api/clients"
console.log(API_BASE)

let clients = [] //клиенты из API
let currentSort = {
    field: 'id',
    order: 'asc'
} //сортировка
let searchTimeout = null
let isLoading = false
console.log(`${currentSort.field} ${currentSort.order}, ${isLoading}`)

function getContactIcon(type) {
    console.log(type)
    const icons = {
        'телефон': '📞',
        'email': '✉️',
        'vk': '📘',
        'facebook': '📙',
        'telegram': '📱',
        'whatsapp': '💬'
    }
    const result = icons[type?.toLowerCase()] || '👤'
    console.log(result)
    return result
}

function formatFullName(client) {
    console.log(`[FORMAT] Форматирование ФИО: ${client.surname} ${client.name} ${client.lastName}`)
    const parts = [client.surname, client.name, client.lastName].filter(p => p && p.trim())
    const result = parts.join(' ') || '-'
    console.log(result)
    return result
}

function formatDate(dateString) {
    console.log(dateString)
    if(!dateString) {
        console.log("Дфта пустая")
        return '-'
    }
    const date = new Date(dateString)
    const result = date.toLocaleString('ru-RU',{
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
    console.log(result)
    return result
}

function escapeHtml(str) {
    if(!str) return ''
    console.log(str.substring(0,30))
    const result = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    return result
}

function renderContacts(contacts) {
    console.log(contacts?.length || 0)
    if (!contacts || contacts.length === 0) {
        console.log("Нет контактов")
        return '<span class="contacts-empty">—</span>'
    }

    const result = contacts.map(contact => {
        const icon = getContactIcon(contact.type)
        const toolTip = `${contact.type}: ${contact.value}`
        console.log(`Контакт ${contact.type} = ${contact.value}, иконка ${icon}`)
        return  `
            <div class="contact-item" title="${escapeHtml(toolTip)}">
                <span class="contact-icon">${icon}</span>
            </div>
        `
    }).join('')
    console.log(`Сгенерировано HTML для ${contacts.length} контактов`)
    return result
}

function renderTable() {
    const table = document.querySelector('.main__table')
    if(!table) {
        console.error("Таблица .main__table не найдена в DOM!")
        return
    }
    console.log("Таблица .main__table найдена")
    let tbody = document.createElement('tbody')
    table.appendChild(tbody)

    console.log(`Применяем сортировку: поле = ${currentSort.field}, порядок = ${currentSort.order}`)

    let sortedClients = [...clients]
    console.log(` Всего клиентов до сортировки: ${sortedClients.length}`)

    sortedClients.sort((a, b) => {
        let valA, valB
        switch (currentSort.field) {
            case 'id':
                valA = a.id
                valB = b.id
                console.log(`Сравнение ID: ${valA} vs ${valB}`)
                break
            case 'fullname':
                valA = formatFullName(a)
                valB = formatFullName(b)
                console.log(`Сравнение ФИО: ${valA} vs ${valB}`)
                break
            case 'createdAt':
                valA = new Date(a.createdAt)
                valB = new Date(b.createdAt)
                console.log(`Сравнение дат создания: ${valA} vs ${valB}`)
                break
            case 'updatedAt':
                valA = new Date(a.updatedAt)
                valB = new Date(b.updatedAt)
                console.log(`Сравнение дат изменения: ${valA} vs ${valB}`)
                break
            default:
                return 0
        }
        if (valA < valB) return currentSort.order === 'asc' ? -1 : 1
        if (valA > valB) return currentSort.order === 'asc' ? 1 : -1
        return 0
    })
    console.log(`Клиентов после сортировки: ${sortedClients.length}`)
    if (sortedClients.length === 0) {
        console.log("нет клиентов")
        tbody.innerHTML = `
            <tr class="main__row">
                <td colspan="6" class="empty-row">Нет клиентов</td>
            </tr>
        `
        return
    }
    tbody.innerHTML = sortedClients.map(client => {
        console.log(`Генерация строки для клиента ID=${client.id}, имя=${client.name}`)
        return `
            <tr class="main__row" data-client-id="${client.id}">
                <td class="main__col">${client.id}</td>
                <td class="main__col">${escapeHtml(formatFullName(client))}</td>
                <td class="main__col">${formatDate(client.createdAt)}</td>
                <td class="main__col">${formatDate(client.updatedAt)}</td>
                <td class="main__col contacts-cell">${renderContacts(client.contacts)}</td>
                <td class="main__col actions-cell">
                    <button class="btn-edit" data-id="${client.id}">✏️ Изменить</button>
                    <button class="btn-delete" data-id="${client.id}">🗑️ Удалить</button>
                </td>
            </tr>
        `
    }).join('')
    console.log('✅ [RENDER_TABLE] Таблица отрисована успешно')
    updateSortIcons()
}

function updateSortIcons() {
    const headers = document.querySelectorAll('.main__hcol')
    console.log(`Найдено заголовков: ${headers.length}`)
    if (headers.length >= 4) {
        const fields = ['id', 'fullname', 'createdAt', 'updatedAt']
        headers.forEach((header, index) => {
            if (index >=4) return
            const field = fields[index]
            let text = header.textContent.replace(/[↑↓↕️]/g, '').trim()
            
            if (currentSort.field === field) {
                text += currentSort.order === 'asc' ? ' ↑' : ' ↓'
            } else {
                text += ' ↕️'
            }
            header.textContent = text
            console.log(`Заголовок ${field}: "${text}"`)
        })
    } else {
        console.warn(`Найдено только ${headers.length} заголовков, ожидалось 4`)
    }
}

async function loadClients(searchQuery = '') {
    console.log(`Загрузка клиентов. Поисковый запрос: "${searchQuery || '(пусто)'}"`)
    if (isLoading) {
        console.log('Уже идёт загрузка, пропускаем')
        return
    }
    isLoading = true
    console.log("isLoading = true")
    showLoading(true)
    try {
        let url = API_BASE
        if (searchQuery) {
            url += `?search=${encodeURIComponent(searchQuery)}`
        }
        console.log(`URL запроса: ${url}`)
        const response = await fetch(url)
        console.log(`Ответ сервера: статус ${response.status}`)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        clients = await response.json()
        console.log(`Получено ${clients.length} клиентов:`)
        console.table(clients.map(c => ({ id: c.id, name: c.name, surname: c.surname })))
        renderTable()
        hideEmptyLoader()
        console.log("Загрузка завершена успешно")
    } catch (error) {
        console.error('❌Ошибка загрузки:', error)
        showError('Не удалось загрузить список клиентов')
    } finally {
        isLoading = false
        showLoading(false)
        console.log("isLoading = false")
    }
}

function setSort(field) {
    console.log(`Установка сортировки. Поле: ${field}, текущий порядок: ${currentSort.order}`)
    if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc'
        console.log(`Тот же поле, меняем порядок на ${currentSort.order}`)
    } else {
        currentSort.field = field
        currentSort.order = 'asc'
        console.log("Новое поле, устанавливаем порядок asc")
    }
    console.log(`Итоговое состояние: поле=${currentSort.field}, порядок=${currentSort.order}`)
    renderTable()
}

function initSorting() {
    const headers = document.querySelectorAll('.main__hcol')
    console.log(`Найдено заголовков: ${headers.length}`)
    const fields = ['id', 'fullname', 'createdAt', 'updatedAt']
    headers.forEach((header, index) => {
        if (index >= 4) return
        header.style.cursor = 'pointer'
        const field = fields[index]
        header.addEventListener('click', () => {
            setSort(field)
        })
    })
    console.log("Обработчики установлены")
}

function initSearch() {
    const searchInput = document.querySelector('.header__search')
    if (!searchInput) {
        console.warn("Поле .header__search не найдено")
        return
    }
    console.log("поле поиска найдено")
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value
        console.log(`Ввод: "${query}"`)
        if (searchTimeout) {
            clearTimeout(searchTimeout)
        }
        searchTimeout = setTimeout(() => {
            console.log(`Таймер сработал, отправляем запрос: "${query}"`)
            loadClients(query)
        }, 300)
        console.log('Таймер установлен на 300мс')
    })
}

async function deleteClient(id) {
    console.log(`Попытка удалить клиента с ID: ${id}`)
    const confirmed = confirm('Вы уверены, что хотите удалить этого клиента?')
    console.log(`Подтверждение: ${confirmed ? 'ДА' : 'НЕТ'}`)
    if (!confirmed) {
        console.log('Удаление отменено пользователем')
        return;
    }
    try {
        console.log(`Отправка DELETE запроса на ${API_BASE}/${id}`)
        const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
        console.log(`Ответ сервера: статус ${response.status}`)
        if (!response.ok) throw new Error('Ошибка удаления')
        console.log('Клиент удалён на сервере')
        await loadClients()
        showMessage('Клиент успешно удалён')
        console.log('✅Удаление завершено, таблица обновлена')
    } catch (error) {
        console.error('❌Ошибка:', error)
        showError('Не удалось удалить клиента')
    }
}

function initTableActions() {
    console.log('Настройка обработчиков кнопок в таблице')
    const table = document.querySelector('.main__table')
    if (!table) {
        console.warn('Таблица .main__table не найдена')
        return
    }
    console.log('Таблица найдена, настраиваем делегирование')
    table.addEventListener('click', (e) => {
        const btn = e.target.closest('button')
        if (!btn) return
        console.log(`Нажата кнопка:`, btn)
        if (btn.classList.contains('btn-edit')) {
            const id = btn.dataset.id
            console.log(`Редактирование клиента ID=${id}`)
            editClient(id)
        } else if (btn.classList.contains('btn-delete')) {
            const id = btn.dataset.id
            console.log(`Удаление клиента ID=${id}`)
            deleteClient(id)
        }
    })
    console.log('Обработчики настроены')
}

async function editClient(id) {
    console.log(`Редактирование клиента ID=${id}`)
    console.log('Поиск клиента в локальном кеше...')
    const client = clients.find(c => c.id == id)
    if (client) {
        console.log('Найден клиент:', client)
    } else {
        console.warn('Клиент не найден в кеше')
    }
    alert(`Редактирование клиента ID: ${id}\nФИО: ${formatFullName(client || {})}\n\n(функция будет добавлена позже)`)
    console.log('Функция редактирования пока в заглушке')
}

function initAddButton() {
    console.log('[INIT_ADD] Настройка кнопки добавления клиента');
    
    const addBtn = document.querySelector('.main__btn');
    if (!addBtn) {
        console.warn('[INIT_ADD] Кнопка .main__btn не найдена');
        return;
    }
    
    console.log('[INIT_ADD] Кнопка найдена');
    
    addBtn.addEventListener('click', () => {
        console.log('[CLICK] Нажата кнопка "Добавить клиента"');
        openAddModal();  // ← ВОТ ЭТО ИЗМЕНЕНИЕ (было alert)
    });
}

function showLoading(show) {
    console.log(`Показать загрузку: ${show}`)
    const loader = document.querySelector('.main__load')
    if (loader) {
        loader.style.display = show ? 'block' : 'none'
        console.log(`loader.style.display = ${loader.style.display}`)
    } else {
        console.warn('Элемент .main__load не найден')
    }
}

function hideEmptyLoader() {
    console.log('hideEmptyLoader вызван')
    const loader = document.querySelector('.main__load')
    if (loader && loader.style.display !== 'none') {
    }
}

function showError(message) {
    console.error(`❌${message}`);
    alert(message)
}

function showMessage(message) {
    console.log(`✅${message}`)
}

// ============================================================
// ДОБАВЛЕНИЕ КЛИЕНТА (МОДАЛЬНОЕ ОКНО)
// ============================================================

// Функция создания модального окна добавления
function createAddModal() {
    console.log('[MODAL] Создание модального окна для добавления клиента');
    
    // Создаём фон
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Создаём окно
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // Заголовок
    const title = document.createElement('h3');
    title.textContent = 'Добавление клиента';
    title.className = 'modal__title';
    
    // Форма
    const form = document.createElement('form');
    form.className = 'modal__form';
    
    // Поле Имя
    const nameInput = createInputField('Имя', 'text', 'name');
    // Поле Фамилия
    const surnameInput = createInputField('Фамилия', 'text', 'surname');
    // Поле Отчество
    const patronymicInput = createInputField('Отчество', 'text', 'lastName');
    
    // Блок контактов
    const contactsBlock = document.createElement('div');
    contactsBlock.className = 'modal__contacts';
    contactsBlock.innerHTML = '<label>Контакты</label>';
    
    const contactsList = document.createElement('div');
    contactsList.className = 'contacts-list';
    contactsList.id = 'contactsList';
    contactsBlock.appendChild(contactsList);
    
    // Кнопка добавления контакта
    const addContactBtn = document.createElement('button');
    addContactBtn.type = 'button';
    addContactBtn.className = 'modal__add-contact';
    addContactBtn.textContent = '+ Добавить контакт';
    addContactBtn.onclick = () => addContactRow(contactsList);
    contactsBlock.appendChild(addContactBtn);
    
    // Кнопки формы
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'modal__buttons';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'modal__save';
    saveBtn.textContent = 'Сохранить';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'modal__cancel';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.onclick = () => closeModal(overlay);
    
    buttonsDiv.appendChild(saveBtn);
    buttonsDiv.appendChild(cancelBtn);
    
    // Собираем форму
    form.appendChild(nameInput);
    form.appendChild(surnameInput);
    form.appendChild(patronymicInput);
    form.appendChild(contactsBlock);
    form.appendChild(buttonsDiv);
    
    // Собираем модальное окно
    modal.appendChild(title);
    modal.appendChild(form);
    overlay.appendChild(modal);
    
    // Обработчик отправки формы
    form.onsubmit = async (e) => {
        e.preventDefault();
        await saveNewClient(nameInput, surnameInput, patronymicInput, contactsList, overlay);
    };
    
    // Закрытие по клику на фон
    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal(overlay);
    };
    
    return overlay;
}

// Создание поля ввода
function createInputField(labelText, type, name) {
    const div = document.createElement('div');
    div.className = 'modal__field';
    
    const label = document.createElement('label');
    label.textContent = labelText;
    
    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.required = true;
    
    div.appendChild(label);
    div.appendChild(input);
    return div;
}

// Добавление строки контакта
function addContactRow(container) {
    console.log('[CONTACT] Добавление новой строки контакта');
    
    const row = document.createElement('div');
    row.className = 'contact-row';
    
    const typeSelect = document.createElement('select');
    typeSelect.className = 'contact-type';
    const types = ['телефон', 'email', 'vk', 'facebook', 'telegram', 'whatsapp'];
    types.forEach(t => {
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t;
        typeSelect.appendChild(option);
    });
    
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'contact-value';
    valueInput.placeholder = 'Значение';
    valueInput.required = true;
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'contact-remove';
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => row.remove();
    
    row.appendChild(typeSelect);
    row.appendChild(valueInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
}

// Сохранение нового клиента
async function saveNewClient(nameField, surnameField, patronymicField, contactsList, overlay) {
    console.log('[SAVE] Начало сохранения клиента');
    
    // Собираем данные из формы
    const name = nameField.querySelector('input').value.trim();
    const surname = surnameField.querySelector('input').value.trim();
    const lastName = patronymicField.querySelector('input').value.trim();
    
    // Валидация
    if (!name) {
        alert('Заполните имя');
        return;
    }
    if (!surname) {
        alert('Заполните фамилию');
        return;
    }
    
    // Собираем контакты
    const contacts = [];
    const contactRows = contactsList.querySelectorAll('.contact-row');
    contactRows.forEach(row => {
        const type = row.querySelector('.contact-type').value;
        const value = row.querySelector('.contact-value').value.trim();
        if (type && value) {
            contacts.push({ type, value });
        }
    });
    
    const clientData = {
        name: name,
        surname: surname,
        lastName: lastName,
        contacts: contacts
    };
    
    console.log('[SAVE] Отправляем данные:', clientData);
    
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        
        console.log('[SAVE] Статус ответа:', response.status);
        
        if (!response.ok) {
            const error = await response.json();
            console.error('[SAVE] Ошибка сервера:', error);
            alert('Ошибка: ' + JSON.stringify(error.errors || 'Не удалось сохранить'));
            return;
        }
        
        const savedClient = await response.json();
        console.log('[SAVE] Клиент сохранён на сервере:', savedClient);
        
        // Закрываем модальное окно
        closeModal(overlay);
        
        // ВАЖНО: Обновляем локальный массив и перерисовываем таблицу
        console.log('[SAVE] Обновляем список клиентов...');
        await loadClients();  // ← ЭТА ФУНКЦИЯ ДОЛЖНА ПЕРЕЗАГРУЖАТЬ ВЕСЬ СПИСОК С СЕРВЕРА
        
        alert('Клиент успешно добавлен!');
        
    } catch (error) {
        console.error('[SAVE] Ошибка:', error);
        alert('Что-то пошло не так...');
    }
}

// Закрытие модального окна
function closeModal(overlay) {
    console.log('[MODAL] Закрытие модального окна');
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
}

// Открытие модального окна добавления
function openAddModal() {
    console.log('[MODAL] Открытие формы добавления клиента');
    const modal = createAddModal();
    document.body.appendChild(modal);
    
    // Добавляем одну пустую строку контакта для удобства
    const contactsList = modal.querySelector('#contactsList');
    if (contactsList) {
        addContactRow(contactsList);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎉 [DOM_READY] DOM полностью загружен, начинаем инициализацию CRM');
    
    console.log('[INIT] Вызов initSorting()');
    initSorting();
    
    console.log('[INIT] Вызов initSearch()');
    initSearch();
    
    console.log('[INIT] Вызов initTableActions()');
    initTableActions();
    
    console.log('[INIT] Вызов initAddButton()');
    initAddButton();
    
    console.log('[INIT] Вызов loadClients()');
    loadClients();
    
    console.log('✅ [INIT] CRM полностью инициализирована');
});

console.log('🏁 [END] Файл script.js полностью загружен и обработан')