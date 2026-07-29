// التهيئة المبدئية ومصفوفات الربط لإدارة الغرفة
let peer = null;
let connections = [];
let myUsername = "";
let roomPassword = "";
let isHost = false;
const MAX_TOTAL_USERS = 4; // حد الغرفة الصارم (أنت + 3 أصدقاء)

// جلب شاشات وأزرار التطبيق المتوافقة تماماً مع الـ HTML
const screens = {
    welcome: document.getElementById('welcome-screen'),
    create: document.getElementById('create-screen'),
    join: document.getElementById('join-screen'),
    chat: document.getElementById('chat-screen')
};

// أزرار التنقل الأساسية بين الشاشات
document.getElementById('btn-choose-create').addEventListener('click', () => changeScreen('create'));
document.getElementById('btn-choose-join').addEventListener('click', () => changeScreen('join'));
document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => changeScreen('welcome'));
});

function changeScreen(target) {
    Object.keys(screens).forEach(key => screens[key].classList.remove('active'));
    screens[target].classList.add('active');
}

// 🟢 منطق زر [إنشاء غرفة جديدة]
document.getElementById('btn-submit-create').addEventListener('click', () => {
    myUsername = document.getElementById('create-username').value.trim();
    roomPassword = document.getElementById('create-password').value.trim();
    const errorEl = document.getElementById('create-error');

    if (!myUsername || !roomPassword) {
        errorEl.innerText = "برجاء ملء جميع الحقول لتوليد مفاتيح التعمية!";
        return;
    }
    errorEl.innerText = "";
    isHost = true;

    // توليد كود عشوائي فريد ومصحح بنقاط برمجية سليمة
    const generatedRoomId = `mil-room-${Math.floor(100000 + Math.random() * 900000)}`;
    initPeerEngine(generatedRoomId, errorEl);
});

// 🔵 منطق زر [الدخول لغرفة موجودة]
document.getElementById('btn-submit-join').addEventListener('click', () => {
    myUsername = document.getElementById('join-username').value.trim();
    const targetHostId = document.getElementById('join-peer-id').value.trim();
    roomPassword = document.getElementById('join-password').value.trim();
    const errorEl = document.getElementById('join-error');

    if (!myUsername || !targetHostId || !roomPassword) {
        errorEl.innerText = "جميع الحقول إلزامية لبناء خطوط الربط المشفرة!";
        return;
    }
    errorEl.innerText = "";
    isHost = false;

    const clientPeerId = `mil-client-${Math.floor(100000 + Math.random() * 900000)}`;
    initPeerEngine(clientPeerId, errorEl, targetHostId);
});

// تأسيس محرك الربط المباشر PeerJS واستقبال الاتصالات النصية والانتقال التلقائي للغرفة
function initPeerEngine(myId, errorDisplayElement, targetHostId = null) {
    peer = new Peer(myId);

    peer.on('open', (id) => {
        // الانتقال الفوري والمضمون لشاشة المحادثة بعد نجاح فتح بروتوكول الاتصال
        changeScreen('chat');
        
        if (isHost) {
            document.getElementById('display-my-id').innerText = id;
            document.getElementById('share-zone').style.display = 'block';
        } else {
            document.getElementById('share-zone').style.display = 'none';
            const conn = peer.connect(targetHostId);
            setupConnection(conn);
        }
    });

    peer.on('connection', (conn) => {
        if (connections.length + 1 >= MAX_TOTAL_USERS) {
            conn.on('open', () => {
                conn.send({ systemEvent: 'full' });
                setTimeout(() => conn.close(), 500);
            });
            return;
        }
        setupConnection(conn);
    });

    peer.on('error', (err) => {
        errorDisplayElement.innerText = "خطأ في الشبكة أو أن المعرّف المستخدم غير صحيح.";
    });
}

function setupConnection(conn) {
    if (connections.find(c => c.peer === conn.peer)) return;
    connections.push(conn);
    updateUserCounter();

    conn.on('data', (data) => {
        if (data.systemEvent === 'full') {
            alert("عذراً، الغرفة امتلأت بحدها الأقصى وهو 4 أشخاص!");
            exitApp();
            return;
        }

        try {
            // فك التشفير العسكري لحظياً داخل المتصفح للرسالة الواردة
            const bytes = CryptoJS.AES.decrypt(data.cipher, roomPassword);
            const clearText = bytes.toString(CryptoJS.enc.Utf8);
            
            if (clearText) {
                renderMessage(data.author, clearText, 'others');
            }
        } catch (e) {
            renderMessage("نظام حماية", "وصلت رسالة مشفرة تعذر فك ترميزها (تأكد من تطابق كلمة السر).", 'system');
        }
    });

    conn.on('close', () => {
        connections = connections.filter(c => c.peer !== conn.peer);
        updateUserCounter();
    });
}

// بث ونقل الرسائل النصية المشفرة عبر الشبكة المباشرة
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');

btnSend.addEventListener('click', broadcastTextMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') broadcastTextMessage(); });

function broadcastTextMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    // تعمية وتشفير كامل محتوى النص محلياً بـ AES-256 قبل الخروج للإنترنت
    const encryptedData = CryptoJS.AES.encrypt(text, roomPassword).toString();

    const payload = {
        author: myUsername,
        cipher: encryptedData
    };

    connections.forEach(conn => {
        if (conn.open) conn.send(payload);
    });

    renderMessage("أنت", text, 'me');
    messageInput.value = "";
}

// عرض الرسائل وتوليد فقاعات الدردشة بدقة تحديد هوية المرسل
const messagesContainer = document.getElementById('messages-container');

function renderMessage(sender, text, type) {
    if (type === 'system') {
        const div = document.createElement('div');
        div.className = 'system-msg';
        div.innerText = text;
        messagesContainer.appendChild(div);
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = `msg-wrapper ${type}`;
        
        const author = document.createElement('div');
        author.className = 'msg-author';
        author.innerText = sender;

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerText = text;

        wrapper.appendChild(author);
        wrapper.appendChild(bubble);
        messagesContainer.appendChild(wrapper);
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateUserCounter() {
    document.getElementById('peer-count').innerText = connections.length + 1;
}

document.getElementById('btn-copy-id').addEventListener('click', () => {
    const idText = document.getElementById('display-my-id').innerText;
    navigator.clipboard.writeText(idText);
    alert("تم نسخ معرّف الغرفة الآمن! أرسله لأصدقائك الآن.");
});

document.getElementById('btn-leave').addEventListener('click', exitApp);

function exitApp() {
    if (peer) peer.destroy();
    connections = [];
    messagesContainer.innerHTML = '<div class="system-msg">🔒 تشفير محلي عسكري مستمر AES-256. جميع الرسائل النصية تمر مباشرة بين الهواتف دون المرور أو التخزين على أي خادم وسيط.</div>';
    
    document.getElementById('create-password').value = "";
    document.getElementById('join-password').value = "";

    changeScreen('welcome');
}

