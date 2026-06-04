//Работа с сервером
const API_LIST = "http://localhost:3000/api/clients"
const API_ITEM = "http://localhost:3000/api/clients"

//тут хранятся все клиенты из API
let clients = []
//сортировка
let currentSort = {
    field: 'id',
    order: 'asc'
}
//для поиска с задержкой
let searchTimeout = null
//чтобы не было двойной загрузки
let isLoading = false
let currentSmartSearch = '' // текущий поисковый запрос

// ============================================================
// ВАЛИДАЦИЯ
// ============================================================

function validateTextField(value, fieldName, minLength = 2) {
    const trimmed = value?.trim()
    if (!trimmed) return `${fieldName} обязательно для заполнения`
    if (trimmed.length < minLength) return `${fieldName} должно содержать минимум ${minLength} символа`
    if (!/^[а-яА-ЯёЁa-zA-Z\s-]+$/.test(trimmed)) return `${fieldName} может содержать только буквы, дефис и пробел`
    return null
}

function validatePhone(value) {
    const trimmed = value?.trim()
    if (!trimmed) return null
    const phoneRegex = /^[\+\d\s\-\(\)]{5,20}$/
    if (!phoneRegex.test(trimmed)) return 'Введите корректный номер телефона'
    return null
}

function validateEmail(value) {
    const trimmed = value?.trim()
    if (!trimmed) return null
    const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/
    if (!emailRegex.test(trimmed)) return 'Введите корректный email (пример: name@domain.ru)'
    return null
}

function validateSocial(value, type) {
    const trimmed = value?.trim()
    if (!trimmed) return null
    if (trimmed.length < 2) return `Введите корректный ${type} (минимум 2 символа)`
    return null
}

function validateContact(type, value) {
    const typeLower = type?.toLowerCase()
    if (typeLower === 'телефон') return validatePhone(value)
    if (typeLower === 'email') return validateEmail(value)
    return validateSocial(value, type)
}

// ============================================================
// КНОПКИ И ИХ ОБРАБОТЧИКИ
// ============================================================

//кнопка добавить клиента
function initAddButton() {
    const addBtn = document.querySelector('.main__btn');
    if (!addBtn) {
        console.warn('[INIT_ADD] Кнопка .main__btn не найдена');
        return;
    }
    addBtn.addEventListener('click', () => {
        openAddModal();
    });
}

//обработчики кнопок в таблице через делегирование
function initTableActions() {
    const table = document.querySelector('.main__table')
    if (!table) {
        console.warn('Таблица .main__table не найдена')
        return
    }
    table.addEventListener('click', (e) => {
        const btn = e.target.closest('button')
        if (!btn) return
        if (btn.classList.contains('btn-edit')) {
            const id = btn.dataset.id
            editClient(id)
        } else if (btn.classList.contains('btn-delete')) {
            const id = btn.dataset.id
            deleteClient(id)
        }
    })
}

//редактирование - открывает модалку с предзаполненными данными
async function editClient(id) {
    console.log(`[EDIT] Редактирование клиента ID=${id}`)
    
    const client = clients.find(c => c.id == id)
    if (!client) {
        console.error('[EDIT] Клиент не найден в кеше')
        showError('Клиент не найден')
        return
    }
    console.log('[EDIT] Найден клиент:', client)
    
    const modal = createEditModal(client)
    document.body.appendChild(modal)
}

//удаление сначала спрашивает подтверждение
async function deleteClient(id) {
    console.log(`Попытка удалить клиента с ID: ${id}`)
    const confirmed = confirm('Вы уверены, что хотите удалить этого клиента?')
    if (!confirmed) return;
    
    try {
        // Пробуем оба варианта эндпоинта
        let response = await fetch(`http://localhost:3000/api/client/${id}`, { 
            method: 'DELETE' 
        })
        
        // Если не сработало, пробуем с /clients (множественное число)
        if (response.status === 404) {
            console.log('Пробуем альтернативный эндпоинт /clients...')
            response = await fetch(`http://localhost:3000/api/clients/${id}`, { 
                method: 'DELETE' 
            })
        }
        
        console.log(`Ответ сервера: статус ${response.status}`)
        
        if (response.status === 404) {
            showError('Клиент не найден на сервере. Обновляем таблицу...')
            await loadClients()
            return
        }
        
        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
        
        console.log('Клиент удалён на сервере')
        await loadClients()
        showMessage('Клиент успешно удалён')
        
    } catch (error) {
        console.error('❌Ошибка удаления:', error)
        showError('Не удалось удалить клиента. Ошибка: ' + error.message)
    }
}

//сортировка по клику на заголовок таблицы
function initSorting() {
    const headers = document.querySelectorAll('.main__hcol')
    const fields = ['id', 'fullname', 'createdAt', 'updatedAt']
    headers.forEach((header, index) => {
        if (index >= 4) return
        header.style.cursor = 'pointer'
        const field = fields[index]
        header.addEventListener('click', () => {
            setSort(field)
        })
    })
}

//Инициализация поиска
function initSearch() {
    const searchInput = document.querySelector('.header__search')
    if (!searchInput) {
        console.warn("Поле .header__search не найдено")
        return
    }
    
    let smartSearchTimeout = null
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value
        if (smartSearchTimeout) {
            clearTimeout(smartSearchTimeout)
        }
        smartSearchTimeout = setTimeout(() => {
            currentSmartSearch = query
            smartFilterClients()
        }, 300)
    })
}

// ============================================================
// ФУНКЦИИ С ОБЪЕКТАМИ (ИКОНКИ, ФОРМАТИРОВАНИЕ)
// ============================================================

//иконки контактов как в задании
function getContactIcon(type) {
    const icons = {
        'телефон': '📞',
        'email': '✉️',
        'vk': '📘',
        'facebook': '📙',
        'telegram': '📱',
        'whatsapp': '💬'
    }
    return icons[type?.toLowerCase()] || '👤'
}

//собирает ФИО из трёх полей, пустые пропускает
function formatFullName(client) {
    const parts = [client.surname, client.name, client.lastName].filter(p => p && p.trim())
    return parts.join(' ') || '-'
}

//дд.мм.гггг чч:мм как в макете
function formatDate(dateString) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

//защита от XSS через вставку html
function escapeHtml(str) {
    if (!str) return ''
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// ============================================================
// ФУНКЦИИ С INNERHTML (ОТРИСОВКА)
// ============================================================

//рисует контакты в виде иконок с тултипом
function renderContacts(contacts) {
    if (!contacts || contacts.length === 0) {
        return '<span class="contacts-empty">—</span>'
    }

    return contacts.map(contact => {
        const icon = getContactIcon(contact.type)
        const toolTip = `${contact.type}: ${contact.value}`
        return `
            <div class="contact-item" title="${escapeHtml(toolTip)}">
                <span class="contact-icon">${icon}</span>
            </div>
        `
    }).join('')
}

//основная таблица, сортирует клиентов перед отрисовкой
function renderTable() {
    const tbody = document.querySelector('.main__table tbody')
    if (!tbody) {
        console.error("Таблица .main__table tbody не найдена в DOM!")
        return
    }

    let sortedClients = [...clients]

    //сортировка массива по выбранному полю
    sortedClients.sort((a, b) => {
        let valA, valB
        switch (currentSort.field) {
            case 'id':
                valA = a.id
                valB = b.id
                break
            case 'fullname':
                valA = formatFullName(a)
                valB = formatFullName(b)
                break
            case 'createdAt':
                valA = new Date(a.createdAt)
                valB = new Date(b.createdAt)
                break
            case 'updatedAt':
                valA = new Date(a.updatedAt)
                valB = new Date(b.updatedAt)
                break
            default:
                return 0
        }
        if (valA < valB) return currentSort.order === 'asc' ? -1 : 1
        if (valA > valB) return currentSort.order === 'asc' ? 1 : -1
        return 0
    })
    
    if (sortedClients.length === 0) {
        tbody.innerHTML = `
            <tr class="main__row">
                <td colspan="6" class="empty-row">Нет клиентов</td>
            </tr>
        `
        return
    }
    
    //генерируем каждую строку через map
    tbody.innerHTML = sortedClients.map(client => {
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
    updateSortIcons()
}

//обновляем стрелочки в заголовках
function updateSortIcons() {
    const headers = document.querySelectorAll('.main__hcol')
    if (headers.length >= 4) {
        const fields = ['id', 'fullname', 'createdAt', 'updatedAt']
        headers.forEach((header, index) => {
            if (index >= 4) return
            const field = fields[index]
            //убираем старые стрелки
            let text = header.textContent.replace(/[↑↓↕️]/g, '').trim()
            
            if (currentSort.field === field) {
                text += currentSort.order === 'asc' ? ' ↑' : ' ↓'
            } else {
                text += ' ↕️'
            }
            header.textContent = text
        })
    } else {
        console.warn(`Найдено только ${headers.length} заголовков, ожидалось 4`)
    }
}

// ============================================================
// УМНЫЙ ПОИСК (ПО ID ИЛИ ПО ТЕКСТУ)
// ============================================================

// Умная фильтрация клиентов (по ID или по тексту)
function smartFilterClients() {
    const query = currentSmartSearch.trim()
    
    if (!query) {
        renderTable()
        return
    }
    
    let filteredClients = []
    
    // Пробуем найти по ID (сравниваем как строки, потому что ID может быть строкой или числом)
    const searchId = query.toString()
    const clientById = clients.find(c => c.id.toString() === searchId)
    
    if (clientById) {
        // Нашли по ID
        filteredClients = [clientById]
    } else {
        // Не нашли по ID - ищем по тексту (ФИО)
        const lowerQuery = query.toLowerCase()
        filteredClients = clients.filter(client => {
            const fullName = formatFullName(client).toLowerCase()
            return fullName.includes(lowerQuery)
        })
    }
    
    renderFilteredTable(filteredClients, query, !!clientById)
}

// Отрисовка отфильтрованной таблицы
function renderFilteredTable(filteredClients, query, isSearchById) {
    const tbody = document.querySelector('.main__table tbody')
    if (!tbody) return
    
    if (filteredClients.length === 0) {
        const notFoundMessage = isSearchById 
            ? `Клиент с ID "${query}" не найден`
            : `Клиенты по запросу "${query}" не найдены`
        
        tbody.innerHTML = `
            <tr class="main__row">
                <td colspan="6" class="empty-row">${notFoundMessage}</td>
            </tr>
        `
        return
    }
    
    // Сортируем отфильтрованных клиентов согласно currentSort
    const sortedClients = [...filteredClients]
    sortedClients.sort((a, b) => {
        let valA, valB
        switch (currentSort.field) {
            case 'id':
                valA = a.id
                valB = b.id
                break
            case 'fullname':
                valA = formatFullName(a)
                valB = formatFullName(b)
                break
            case 'createdAt':
                valA = new Date(a.createdAt)
                valB = new Date(b.createdAt)
                break
            case 'updatedAt':
                valA = new Date(a.updatedAt)
                valB = new Date(b.updatedAt)
                break
            default:
                return 0
        }
        if (valA < valB) return currentSort.order === 'asc' ? -1 : 1
        if (valA > valB) return currentSort.order === 'asc' ? 1 : -1
        return 0
    })
    
    tbody.innerHTML = sortedClients.map(client => `
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
    `).join('')
}

// ============================================================
// ВСЁ ОСТАЛЬНОЕ (ЗАГРУЗКА, МОДАЛКИ, ВСПОМОГАТЕЛЬНЫЕ)
// ============================================================

//загрузка с сервера, поддержка поискового запроса
async function loadClients(searchQuery = '') {
    if (isLoading) {
        return
    }
    isLoading = true
    showLoading(true)
    try {
        // Для получения списка используем /api/clients (со множественным числом)
        let url = API_LIST
        if (searchQuery) {
            url += `?search=${encodeURIComponent(searchQuery)}`
        }
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        clients = await response.json()
        renderTable()
        hideEmptyLoader()
    } catch (error) {
        console.error('❌Ошибка загрузки:', error)
        showError('Не удалось загрузить список клиентов')
    } finally {
        isLoading = false
        showLoading(false)
    }
}

//показать/скрыть индикатор загрузки
function showLoading(show) {
    const loader = document.querySelector('.main__load')
    if (loader) {
        loader.style.display = show ? 'block' : 'none'
    } else {
        console.warn('Элемент .main__load не найден')
    }
}

//скрывает пустой лоадер если есть
function hideEmptyLoader() {
    const loader = document.querySelector('.main__load')
    if (loader && loader.style.display !== 'none') {
    }
}

//показываем ошибку через alert
function showError(message) {
    console.error(`❌${message}`);
    alert(message)
}

function showMessage(message) {
    alert(message)
}

// ============================================================
// МОДАЛЬНЫЕ ОКНА
// ============================================================

//создаём модалку добавления
function createAddModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const title = document.createElement('h3');
    title.textContent = 'Добавление клиента';
    title.className = 'modal__title';
    
    const form = document.createElement('form');
    form.className = 'modal__form';
    
    const nameInput = createInputField('Имя', 'text', 'name');
    const surnameInput = createInputField('Фамилия', 'text', 'surname');
    const patronymicInput = createInputField('Отчество', 'text', 'lastName', false);
    
    const contactsBlock = document.createElement('div');
    contactsBlock.className = 'modal__contacts';
    contactsBlock.innerHTML = '<label>Контакты</label>';
    
    const contactsList = document.createElement('div');
    contactsList.className = 'contacts-list';
    contactsList.id = 'contactsList';
    contactsBlock.appendChild(contactsList);
    
    const addContactBtn = document.createElement('button');
    addContactBtn.type = 'button';
    addContactBtn.className = 'modal__add-contact';
    addContactBtn.textContent = '+ Добавить контакт';
    addContactBtn.onclick = () => addContactRow(contactsList);
    contactsBlock.appendChild(addContactBtn);
    
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
    
    form.appendChild(nameInput);
    form.appendChild(surnameInput);
    form.appendChild(patronymicInput);
    form.appendChild(contactsBlock);
    form.appendChild(buttonsDiv);
    
    modal.appendChild(title);
    modal.appendChild(form);
    overlay.appendChild(modal);
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = nameInput.querySelector('input').value.trim();
        const surname = surnameInput.querySelector('input').value.trim();
        const lastName = patronymicInput.querySelector('input').value.trim();
        const contacts = collectContacts(contactsList);
        
        if (!validateForm(name, surname, contacts)) return;
        
        await saveNewClient(name, surname, lastName, contacts, overlay);
    };
    
    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal(overlay);
    };
    
    return overlay;
}

//модалка редактирования с предзаполненными полями
function createEditModal(client) {
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    
    const modal = document.createElement('div')
    modal.className = 'modal'
    
    const title = document.createElement('h3')
    title.textContent = 'Редактирование клиента'
    title.className = 'modal__title'
    
    const form = document.createElement('form')
    form.className = 'modal__form'
    
    const nameDiv = createInputField('Имя', 'text', 'name')
    const surnameDiv = createInputField('Фамилия', 'text', 'surname')
    const patronymicDiv = createInputField('Отчество', 'text', 'lastName', false)
    
    nameDiv.querySelector('input').value = client.name || ''
    surnameDiv.querySelector('input').value = client.surname || ''
    patronymicDiv.querySelector('input').value = client.lastName || ''
    
    const contactsBlock = document.createElement('div')
    contactsBlock.className = 'modal__contacts'
    contactsBlock.innerHTML = '<label>Контакты</label>'
    
    const contactsList = document.createElement('div')
    contactsList.className = 'contacts-list'
    contactsList.id = 'contactsListEdit'
    contactsBlock.appendChild(contactsList)
    
    if (client.contacts && client.contacts.length > 0) {
        client.contacts.forEach(contact => {
            addContactRow(contactsList, contact.type, contact.value)
        })
    }
    
    const addContactBtn = document.createElement('button')
    addContactBtn.type = 'button'
    addContactBtn.className = 'modal__add-contact'
    addContactBtn.textContent = '+ Добавить контакт'
    addContactBtn.onclick = () => addContactRow(contactsList)
    contactsBlock.appendChild(addContactBtn)
    
    const buttonsDiv = document.createElement('div')
    buttonsDiv.className = 'modal__buttons'
    
    const saveBtn = document.createElement('button')
    saveBtn.type = 'submit'
    saveBtn.className = 'modal__save'
    saveBtn.textContent = 'Сохранить'
    
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'modal__cancel'
    cancelBtn.textContent = 'Отмена'
    cancelBtn.onclick = () => closeModal(overlay)
    
    buttonsDiv.appendChild(saveBtn)
    buttonsDiv.appendChild(cancelBtn)
    
    form.appendChild(nameDiv)
    form.appendChild(surnameDiv)
    form.appendChild(patronymicDiv)
    form.appendChild(contactsBlock)
    form.appendChild(buttonsDiv)
    
    modal.appendChild(title)
    modal.appendChild(form)
    overlay.appendChild(modal)
    
    form.onsubmit = async (e) => {
        e.preventDefault()
        const name = nameDiv.querySelector('input').value.trim()
        const surname = surnameDiv.querySelector('input').value.trim()
        const lastName = patronymicDiv.querySelector('input').value.trim()
        const contacts = collectContacts(contactsList)
        
        if (!validateForm(name, surname, contacts)) return
        
        await updateClient(client.id, name, surname, lastName, contacts, overlay)
    }
    
    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal(overlay)
    }
    
    return overlay
}

//вспомогательная функция для создания полей ввода
function createInputField(labelText, type, name, required = true) {
    const div = document.createElement('div');
    div.className = 'modal__field';
    
    const label = document.createElement('label');
    label.textContent = labelText;
    
    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    if (required) input.required = true;
    
    div.appendChild(label);
    div.appendChild(input);
    return div;
}

//добавляет строку контакта в модалку, можно предзаполнить
function addContactRow(container, presetType = '', presetValue = '') {
    const row = document.createElement('div')
    row.className = 'contact-row'
    
    const typeSelect = document.createElement('select')
    typeSelect.className = 'contact-type'
    const types = ['телефон', 'email', 'vk', 'facebook', 'telegram', 'whatsapp']
    types.forEach(t => {
        const option = document.createElement('option')
        option.value = t
        option.textContent = t
        if (t === presetType) option.selected = true
        typeSelect.appendChild(option)
    })
    
    const valueInput = document.createElement('input')
    valueInput.type = 'text'
    valueInput.className = 'contact-value'
    valueInput.placeholder = 'Значение'
    valueInput.value = presetValue || ''
    
    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'contact-remove'
    removeBtn.textContent = '✕'
    removeBtn.onclick = () => row.remove()
    
    row.appendChild(typeSelect)
    row.appendChild(valueInput)
    row.appendChild(removeBtn)
    container.appendChild(row)
}

function collectContacts(contactsList) {
    const contacts = [];
    const rows = contactsList.querySelectorAll('.contact-row');
    rows.forEach(row => {
        const type = row.querySelector('.contact-type').value;
        const value = row.querySelector('.contact-value').value.trim();
        if (type && value) {
            contacts.push({ type, value });
        }
    });
    return contacts;
}

function validateForm(name, surname, contacts) {
    const nameError = validateTextField(name, 'Имя')
    if (nameError) { alert(nameError); return false }
    
    const surnameError = validateTextField(surname, 'Фамилия')
    if (surnameError) { alert(surnameError); return false }
    
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        const contactError = validateContact(contact.type, contact.value)
        if (contactError) {
            alert(`Ошибка в контакте "${contact.type}": ${contactError}`)
            return false
        }
    }
    return true
}

//отправка POST запроса на сервер
async function saveNewClient(name, surname, lastName, contacts, overlay) {
    try {
        const response = await fetch(API_LIST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, surname, lastName, contacts })
        });
        
        if (response.status === 422) {
            const errors = await response.json();
            alert('Ошибка валидации: ' + errors.map(e => e.message).join(', '));
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        closeModal(overlay);
        await loadClients();
        alert('Клиент успешно добавлен!');
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Что-то пошло не так...');
    }
}

//отправка PATCH запроса для обновления
async function updateClient(id, name, surname, lastName, contacts, overlay) {
    try {
        const response = await fetch(`${API_ITEM}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, surname, lastName, contacts })
        })
        
        if (response.status === 422) {
            const errors = await response.json();
            alert('Ошибка валидации: ' + errors.map(e => e.message).join(', '));
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }
        
        closeModal(overlay)
        await loadClients()
        alert('Клиент успешно обновлён')
        
    } catch (error) {
        console.error('Ошибка обновления:', error)
        alert('Что-то пошло не так...')
    }
}

//закрыть модалку
function closeModal(overlay) {
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
}

//открыть модалку добавления и сразу добавить одну пустую строку контакта
function openAddModal() {
    const modal = createAddModal();
    document.body.appendChild(modal);
    
    const contactsList = modal.querySelector('#contactsList');
    if (contactsList) {
        addContactRow(contactsList);
    }
}

// ============================================================
// СТАРТ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initSorting();
    initSearch();
    initTableActions();
    initAddButton();
    loadClients();
});