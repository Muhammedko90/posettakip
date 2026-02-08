/**
 * Giriş / Çıkış ve kimlik doğrulama işlemleri
 */
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

/**
 * E-posta/şifre ile giriş
 */
export async function login(auth, email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Yeni hesap oluşturma
 */
export async function register(auth, email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Çıkış yap
 */
export function logout(auth) {
    return signOut(auth);
}

/**
 * Şifre sıfırlama e-postası gönder
 */
export async function sendPasswordReset(auth, email) {
    return sendPasswordResetEmail(auth, email);
}

/**
 * Yeniden kimlik doğrulama (şifre değiştirme / tehlikeli işlemler öncesi)
 */
export async function reauthenticate(user, password) {
    const credential = EmailAuthProvider.credential(user.email, password);
    return reauthenticateWithCredential(user, credential);
}

/**
 * Kullanıcı şifresini güncelle
 */
export async function changePassword(user, newPassword) {
    return updatePassword(user, newPassword);
}

/**
 * Giriş, kayıt, şifremi unuttum ve çıkış formlarına olay dinleyicileri bağlar
 * @param {object} auth - Firebase Auth instance
 * @param {object} dom - DOM referansları (loginForm, registerForm, ...)
 * @param {object} callbacks - { showLoading, hideLoading, onLoginSuccess?(user), onRegisterSuccess?(user) }
 */
export function setupAuthEventListeners(auth, dom, callbacks) {
    const { showLoading, hideLoading, onLoginSuccess, onRegisterSuccess } = callbacks;

    dom.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading('Giriş yapılıyor...');
        dom.loginError.classList.add('hidden');
        const email = dom.loginForm['login-email'].value;
        const password = dom.loginForm['login-password'].value;
        try {
            const userCredential = await login(auth, email, password);
            hideLoading();
            if (typeof onLoginSuccess === 'function') {
                onLoginSuccess(userCredential.user);
            }
        } catch (error) {
            dom.loginError.textContent = "Giriş başarısız. E-posta veya şifre hatalı.";
            dom.loginError.classList.remove('hidden');
            hideLoading();
        }
    });

    dom.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading('Hesap oluşturuluyor...');
        dom.registerError.classList.add('hidden');
        const email = dom.registerForm['register-email'].value;
        const password = dom.registerForm['register-password'].value;
        if (password.length < 6) {
            dom.registerError.textContent = 'Şifre en az 6 karakter olmalıdır.';
            dom.registerError.classList.remove('hidden');
            hideLoading();
            return;
        }
        try {
            const userCredential = await register(auth, email, password);
            hideLoading();
            if (typeof onRegisterSuccess === 'function') {
                onRegisterSuccess(userCredential.user);
            }
        } catch (error) {
            dom.registerError.textContent = "Kayıt başarısız. Bu e-posta zaten kullanılıyor olabilir.";
            dom.registerError.classList.remove('hidden');
            hideLoading();
        }
    });

    dom.forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = dom.forgotPasswordForm['forgot-email'].value;
        showLoading('Sıfırlama linki gönderiliyor...');
        dom.forgotError.classList.add('hidden');
        dom.forgotSuccess.classList.add('hidden');
        try {
            await sendPasswordReset(auth, email);
            dom.forgotSuccess.textContent = 'Sıfırlama linki e-posta adresinize gönderildi.';
            dom.forgotSuccess.classList.remove('hidden');
        } catch (err) {
            dom.forgotError.textContent = 'E-posta gönderilemedi. Adresin doğru olduğundan emin olun.';
            dom.forgotError.classList.remove('hidden');
        } finally {
            hideLoading();
        }
    });

    dom.logoutBtn.addEventListener('click', () => {
        logout(auth);
    });

    dom.showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dom.loginForm.classList.add('hidden');
        dom.registerForm.classList.remove('hidden');
        dom.forgotPasswordForm.classList.add('hidden');
    });

    dom.showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dom.loginForm.classList.remove('hidden');
        dom.registerForm.classList.add('hidden');
        dom.forgotPasswordForm.classList.add('hidden');
    });

    dom.forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        dom.loginForm.classList.add('hidden');
        dom.registerForm.classList.add('hidden');
        dom.forgotPasswordForm.classList.remove('hidden');
    });

    dom.backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        dom.loginForm.classList.remove('hidden');
        dom.registerForm.classList.add('hidden');
        dom.forgotPasswordForm.classList.add('hidden');
    });
}
