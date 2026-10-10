const toast = document.getElementById("toast");
let toastTimer;
function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("answerOne").focus();
  notify("Handshake started — complete the quest on the middle screen.");
});

document.getElementById("answerBtn").addEventListener("click", () => {
  const one = document.getElementById("answerOne").value.trim();
  const two = document.getElementById("answerTwo").value.trim();
  const hint = document.getElementById("answerHint");
  if (!one || !two) {
    hint.textContent = "Please fill both answer fields before continuing.";
    hint.style.color = "#b44b50";
    notify("Add both answers to continue.");
    return;
  }
  hint.textContent = "Quest answers saved for this demo. You're ready to sign.";
  hint.style.color = "#27845a";
  document.getElementById("gpsText").textContent = "OK";
  document.getElementById("gpsText").parentElement.style.color = "#27845a";
  notify("Quest complete! Move to the signing screen.");
});

document.getElementById("signBtn").addEventListener("click", () => {
  const one = document.getElementById("answerOne").value.trim();
  const two = document.getElementById("answerTwo").value.trim();
  if (!one || !two) {
    notify("Complete the quest first, then sign the handshake.");
    return;
  }
  document.getElementById("bobStatus").textContent = "Demo signed";
  document.querySelector(".waiting").style.background = "linear-gradient(145deg,#d8f6dd,#83d59a)";
  document.querySelector(".question-mark").textContent = "✓";
  document.getElementById("successTitle").textContent = "Handshake complete (demo)";
  document.getElementById("successText").textContent = "Both demo signatures are shown. No wallet transaction or blockchain record was created.";
  notify("Demo handshake signed. Connect a wallet/backend for real signatures.");
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  notify("Settings are a prototype placeholder.");
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    notify(`${button.dataset.tab} selected — section is a prototype placeholder.`);
  });
});

// Build a decorative QR-like pattern. It is not a scannable handshake payload.
const qr = document.getElementById("qrCode");
for (let i = 0; i < 90; i++) {
  const cell = document.createElement("i");
  cell.style.position = "absolute";
  cell.style.width = "7%";
  cell.style.height = "7%";
  cell.style.left = `${(i * 37 + (i % 7) * 13) % 93}%`;
  cell.style.top = `${(i * 53 + (i % 5) * 9) % 93}%`;
  cell.style.background = i % 4 === 0 ? "#fff" : "#111";
  qr.appendChild(cell);
}
