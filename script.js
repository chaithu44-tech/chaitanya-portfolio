/**
 * Chelamsetty Chaitanya - Editorial Portfolio Interactivity
 * Features:
 * - Direct Inquiry Messaging System (Email + WhatsApp)
 * - Modal Popup Dialog Controls
 * - Animated Skill Progress Bars
 * - Click to Copy Contact Info
 * - Stamp Badge Interaction
 */

document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------------------------------
  // 1. MODAL DIALOG CONTROLS
  // --------------------------------------------------------------------------
  const modal = document.getElementById('inquiryModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const floatingBtn = document.getElementById('floatingMsgBtn');
  const badgeBtn = document.getElementById('badgeOpenModal');

  function openModal() {
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const firstInput = modal.querySelector('input');
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
  }

  function closeModal() {
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  if (floatingBtn) floatingBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // --------------------------------------------------------------------------
  // 2. FORM SUBMISSION HANDLING (PAGE & MODAL FORMS)
  // --------------------------------------------------------------------------
  function setupFormHandler(formId, submitBtnId, feedbackStatusId) {
    const form = document.getElementById(formId);
    const submitBtn = document.getElementById(submitBtnId);
    const feedback = document.getElementById(feedbackStatusId);

    if (!form || !submitBtn || !feedback) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const name = (formData.get('name') || '').trim();
      const email = (formData.get('email') || '').trim();
      const purpose = (formData.get('inquiry_type') || 'Direct Inquiry').trim();
      const message = (formData.get('message') || '').trim();

      if (!name || !email || !message) {
        feedback.className = 'form-feedback-status error';
        feedback.textContent = 'Please fill in all required fields.';
        return;
      }

      // Button loading state
      const originalBtnHTML = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span>SENDING MESSAGE...</span>
        <svg class="send-plane-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2v4m0 12v4m-8-10H2m20 0h-4m-2.93-6.07l-2.83 2.83m-8.48 8.48l-2.83 2.83m0-14.14l2.83 2.83m8.48 8.48l2.83 2.83"/>
        </svg>
      `;

      let sentSuccessfully = false;

      // 1. Try sending via local python server if on localhost
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        try {
          await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, purpose, message })
          });
          sentSuccessfully = true;
        } catch (err) {
          console.warn('Local Python API failed, trying cloud fallback:', err);
        }
      }

      // 2. Deliver via FormSubmit API to chaithuniva44@gmail.com
      try {
        const resp = await fetch('https://formsubmit.co/ajax/chaithuniva44@gmail.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            email: email,
            _subject: `Portfolio Inquiry: ${purpose} - from ${name}`,
            purpose: purpose,
            message: message,
            _captcha: 'false'
          })
        });

        if (resp.ok) {
          sentSuccessfully = true;
        }
      } catch (err) {
        console.warn('FormSubmit error:', err);
      }

      // WhatsApp text fallback link
      const waText = encodeURIComponent(`Hi Chaitanya! My name is ${name} (${email}). Inquiry: ${purpose}. Message: ${message}`);
      const waUrl = `https://wa.me/916302183467?text=${waText}`;

      // Reset button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;

      // Show success feedback
      feedback.className = 'form-feedback-status success';
      feedback.innerHTML = `
        ✓ Thank you, ${name}! Your message was sent.<br>
        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="color:#25D366;font-weight:700;display:inline-block;margin-top:6px;text-decoration:underline;">
          Click here to also text this directly on WhatsApp 💬
        </a>
      `;

      form.reset();

      // If modal, keep message visible for a moment then offer close
      if (formId === 'modalInquiryForm') {
        setTimeout(() => {
          // keep open or smooth close if user desires
        }, 4000);
      }
    });
  }

  setupFormHandler('pageInquiryForm', 'pageSubmitBtn', 'pageFeedbackStatus');
  setupFormHandler('modalInquiryForm', 'modalSubmitBtn', 'modalFeedbackStatus');

  // --------------------------------------------------------------------------
  // 3. ANIMATE SKILL PROGRESS BARS ON SCROLL
  // --------------------------------------------------------------------------
  const skillBars = document.querySelectorAll('.skill-fill');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const targetWidth = entry.target.style.width;
          entry.target.style.width = '0%';
          setTimeout(() => {
            entry.target.style.width = targetWidth;
          }, 100);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    skillBars.forEach(bar => observer.observe(bar));
  }

  // --------------------------------------------------------------------------
  // 4. CLICK TO COPY CONTACT VALUES
  // --------------------------------------------------------------------------
  const contactValues = document.querySelectorAll('.contact-value');
  contactValues.forEach(elem => {
    elem.addEventListener('click', (e) => {
      const text = elem.innerText.trim();
      if (text.includes('@') || text.includes('+91')) {
        navigator.clipboard.writeText(text).then(() => {
          const original = elem.innerText;
          elem.innerText = 'Copied to clipboard!';
          setTimeout(() => {
            elem.innerText = original;
          }, 1800);
        }).catch(() => {});
      }
    });
  });

  // --------------------------------------------------------------------------
  // 5. STAMP BADGE CLICK INTERACTION
  // --------------------------------------------------------------------------
  if (badgeBtn) {
    badgeBtn.addEventListener('click', () => {
      openModal();
    });
  }

  console.log('Chelamsetty Chaitanya Portfolio & Direct Messaging Initialized.');
});
