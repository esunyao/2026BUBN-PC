package cn.commonagora.world.auth

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.MediaType
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.util.HtmlUtils

@RestController
class LoginPageController {
    @GetMapping("/login", produces = [MediaType.TEXT_HTML_VALUE])
    fun login(request: HttpServletRequest): String {
        val csrf = request.getAttribute(CsrfToken::class.java.name) as CsrfToken
        val error = if (request.getParameter("error") != null) "登录失败，请核对用户名与密码。" else ""
        return """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>共同时刻 · 登录</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eae8df;color:#344843;font:16px system-ui}
main{width:min(340px,calc(100vw - 64px));padding:32px;border:1px solid #c2ccc3;background:#f8f7ef;border-radius:16px;box-shadow:0 12px 40px #34484318}
h1{font-size:26px;letter-spacing:2px}p{line-height:1.6;color:#65796d}label{display:block;margin:20px 0 8px}
input,button{box-sizing:border-box;width:100%;padding:12px;border:1px solid #b2c1b4;border-radius:7px;font:inherit}button{margin-top:24px;background:#456655;color:white;cursor:pointer}button:disabled{opacity:.5}#message{color:#923d34}
</style></head><body><main><p>ARCHIPELAGO / 共同时刻</p><h1>回到我们的群岛</h1><p>登录后继续记录与发现共同的回忆。</p>
<form id="login" method="post" action="/login">
<input type="hidden" name="${HtmlUtils.htmlEscape(csrf.parameterName)}" value="${HtmlUtils.htmlEscape(csrf.token)}">
<input type="hidden" id="digest" name="passwordDigest">
<label for="username">用户名</label><input id="username" name="username" autocomplete="username" required maxlength="32">
<label for="password">密码</label><input id="password" type="password" autocomplete="current-password" required>
<button id="submit" type="submit" disabled>登录</button><p id="message" role="alert">$error</p>
<noscript>登录需要 JavaScript 与安全连接，请启用 JavaScript 后重试。</noscript></form></main>
<script>
const form=document.getElementById('login'), button=document.getElementById('submit'), message=document.getElementById('message');
if(window.isSecureContext && window.crypto && window.crypto.subtle){button.disabled=false;}
else{message.textContent='当前环境不支持安全密码处理，请使用 HTTPS 或 localhost。';}
form.addEventListener('submit',async event=>{event.preventDefault();if(button.disabled)return;button.disabled=true;
try{const field=document.getElementById('password');const bytes=new TextEncoder().encode(field.value);
const hash=await window.crypto.subtle.digest('SHA-256',bytes);
document.getElementById('digest').value=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
field.value='';HTMLFormElement.prototype.submit.call(form);
}catch(error){message.textContent='安全密码处理失败，请重试。';button.disabled=false;}});
</script></body></html>"""
    }
}
