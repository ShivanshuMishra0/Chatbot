document.addEventListener("DOMContentLoaded", () => {
  const API = "http://127.0.0.1:5000";

  /* ==========================================
     0. INITIALIZATION & THEME
  ========================================== */
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-theme");
  }

  const displayUserName = document.getElementById("usernameDisplay");
  if (displayUserName) {
    displayUserName.textContent = localStorage.getItem("username") || "Sachin";
  }

  loadChatHistory();

 /* ==========================================
     1. SIGNUP LOGIC (New Addition for Sachin)
  ========================================== */
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("msg"); // Message display area
      
      const fullname = document.getElementById("fullname").value;
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      try {
        const res = await fetch(`${API}/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullname, email, password })
        });

        const data = await res.json();
        
        if (data.success) {
          if(msg) {
            msg.style.color = "#34d399";
            msg.textContent = "Account Created! Redirecting to Login...";
          }
          // 1.5 second baad login page par bhej dega
          setTimeout(() => { window.location.href = "BOT.html"; }, 1500); 
        } else {
          if(msg) {
            msg.style.color = "#fb7185";
            msg.textContent = data.message || "Signup failed.";
          }
        }
      } catch (error) {
        if(msg) msg.textContent = "Server Offline, Sir.";
      }
    });
  }

  /* ==========================================
     1. LOGIN LOGIC
  ========================================== */
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("msg");
      msg.textContent = "Authenticating with Jarvis...";
      msg.style.color = "#38bdf8";

      try {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const res = await fetch(`${API}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        
        if (data.success) {
          msg.style.color = "#34d399";
          msg.textContent = "Access Granted, Sir!";
          localStorage.setItem("username", data.fullname);
          localStorage.setItem("userEmail", email);
          
          setTimeout(() => { window.location.href = "BOT_otp.html"; }, 1000);
        } else {
          msg.style.color = "#fb7185";
          msg.textContent = data.message || "Invalid credentials.";
        }
      } catch (error) {
        msg.style.color = "#fb7185";
        msg.textContent = "Neural Link Failed: Server Offline.";
      }
    });
  }

  /* ==========================================
     2. CHAT & JARVIS INTERACTION
  ========================================== */
  const chatForm = document.getElementById("chatForm");
  const chatDisplay = document.getElementById("chatDisplay");
  const greetingArea = document.getElementById("greetingArea");

  if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const chatInput = document.getElementById("chatInput");
      const userMsg = chatInput.value.trim();
      
      if (!userMsg) return;

      if (greetingArea) greetingArea.style.display = "none";
      if (chatDisplay) chatDisplay.style.display = "flex";

      appendMessage("user-message", userMsg);
      chatInput.value = "";
      chatInput.disabled = true;

      try {
        const res = await fetch(`${API}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: localStorage.getItem("userEmail"), message: userMsg })
        });
        
        const data = await res.json();
        if (data.success) {
          appendMessage("bot-message", data.response);
          loadChatHistory();
        }
      } catch (err) {
        appendMessage("bot-message", "Sir, connection to the server was lost.");
      } finally {
        chatInput.disabled = false;
        chatInput.focus();
      }
    });
  }

  function appendMessage(className, text) {
    if (!chatDisplay) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${className}`;
    chatDisplay.appendChild(msgDiv);
    
    if (className === "bot-message") {
      let i = 0;
      msgDiv.textContent = ""; 
      function type() { 
        if(i < text.length) { 
          msgDiv.textContent += text.charAt(i); 
          i++; 
          setTimeout(type, 15); 
          chatDisplay.scrollTop = chatDisplay.scrollHeight;
        } 
      }
      type();
    } else { 
      msgDiv.textContent = text; 
    }
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
  }

  /* ==========================================
     3. CONVERSATION MANAGEMENT (2 Buttons)
  ========================================== */
  
  // A. Clear Ongoing Screen (Does not delete from DB)
  const clearOngoingBtn = document.getElementById("clearOngoingBtn");
  if (clearOngoingBtn) {
    clearOngoingBtn.onclick = () => {
      if (chatDisplay) chatDisplay.innerHTML = "";
      if (chatDisplay) chatDisplay.style.display = "none";
      if (greetingArea) greetingArea.style.display = "flex";
      console.log("System: Ongoing screen cleared by user.");
    };
  }

  // app.js mein 'Purge History' button ka logic
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

if (clearHistoryBtn) {
    clearHistoryBtn.onclick = async () => {
        if (!confirm("Sir, are you sure? This will PERMANENTLY delete all records from the database.")) return;

        const email = localStorage.getItem("userEmail");
        
        try {
            // URL MUST MATCH THE PYTHON ROUTE: /clear-history
            const res = await fetch(`${API}/clear-history`, { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email })
            });

            const data = await res.json();

            if (data.success) {
                // Sidebar refresh
                const container = document.querySelector(".chat-history-container");
                if (container) container.innerHTML = "No recent chats.";
                
                alert(data.message);
                loadChatHistory();
            } else {
                alert("Sir, the database returned an error: " + data.message);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
            alert("Sir, I'm unable to reach the database. Please ensure 'app.py' is running.");
        }
    };
}

  /* ==========================================
     4. OTP LOGIC
  ========================================== */
  const otpForm = document.getElementById("otpForm");
  if (otpForm) {
    otpForm.addEventListener("submit", (e) => {
      e.preventDefault();
      let otp = "";
      document.querySelectorAll(".otp-input").forEach(i => otp += i.value);
      if (otp === "123456") {
        window.location.assign("BOT_dashboard.html");
      } else {
        const msg = document.getElementById("msg");
        if(msg) msg.textContent = "Invalid OTP";
      }
    });
  }

  /* ==========================================
     5. THEME TOGGLE
  ========================================== */
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("light-theme");
      const isLight = document.body.classList.contains("light-theme");
      localStorage.setItem("theme", isLight ? "light" : "dark");
    });
  }

  /* ==========================================
     6. HISTORY FETCHING
  ========================================== */
  async function loadChatHistory() {
    const email = localStorage.getItem("userEmail");
    const container = document.querySelector(".chat-history-container");
    
    if (!email || !container) return;

    try {
      const res = await fetch(`${API}/get-chats?email=${email}`);
      const data = await res.json();
      
      if (data.success) {
        container.innerHTML = data.chats.length ? "" : "No recent chats.";
        data.chats.forEach(chat => {
          const item = document.createElement("div");
          item.className = "nav-item";
          item.style.fontSize = "0.8rem";
          item.innerHTML = `<span>💬</span> ${chat.user_msg.substring(0, 15)}...`;
          container.appendChild(item);
        });
      }
    } catch (err) {
      console.error("Neural link to history failed:", err);
    }
  }

  /* ==========================================
   7. NAVIGATION: NEW THREAD & ANALYTICS
========================================== */

// --- New Thread Logic ---
const newChatBtn = document.getElementById("newChatBtn");
if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
        const chatDisplay = document.getElementById("chatDisplay");
        const greetingArea = document.getElementById("greetingArea");
        const chatInput = document.getElementById("chatInput");

        // UI ko reset karein
        if (chatDisplay) {
            chatDisplay.innerHTML = "";
            chatDisplay.style.display = "none";
        }
        if (greetingArea) {
            greetingArea.style.display = "flex";
            greetingArea.style.opacity = "1";
        }
        if (chatInput) {
            chatInput.value = "";
            chatInput.focus();
        }
        
        console.log("Jarvis: New neural thread initialized, Sir.");
    });
}

// --- Analytics Tab Logic ---
const generateInsightsBtn = document.getElementById("generateInsightsBtn");
if (generateInsightsBtn) {
    generateInsightsBtn.addEventListener("click", () => {
        // Redirect to the insights page
        window.location.href = "BOT_insights.html";
    });
}

});