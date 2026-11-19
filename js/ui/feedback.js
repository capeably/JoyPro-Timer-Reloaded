/* ═══════════════════════════════════════════════════════════════
   JoyPro Timer Reloaded · feedback.js
   Toasts, one-time tips, and promise-based dialogs: confirm, the
   unsaved-changes prompt, and the name prompt. Dialogs are native
   <dialog> elements, so focus trapping, Esc and focus restore come
   built in (an open item on the original's roadmap).
   ═══════════════════════════════════════════════════════════════ */
(function (JP) {
  'use strict';

  const U = JP.util;
  const S = JP.store;
  const A = JP.actions;
  const ui = (JP.ui = JP.ui || {});

  /* ── Toasts ────────────────────────────────────────────────── */
  const toastsEl = U.$('#toasts');
  // As a manual popover, the toast stack can float above open dialogs (the top layer).
  const canPopover = typeof toastsEl.showPopover === 'function';
  if (canPopover) toastsEl.setAttribute('popover', 'manual');

  function raiseToasts() {
    if (!canPopover) return;
    try {
      if (toastsEl.matches(':popover-open')) toastsEl.hidePopover();
      toastsEl.showPopover();
    } catch (e) { /* ignore */ }
  }

  ui.toast = (message, type) => {
    if (!message) return;
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.innerHTML = '<span class="toast-mark" aria-hidden="true"></span><span class="toast-text"></span>';
    t.lastChild.textContent = message;
    toastsEl.appendChild(t);
    while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
    raiseToasts();
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('is-in')));
    const life = Math.min(5600, 2400 + message.length * 30);
    setTimeout(() => {
      t.classList.remove('is-in');
      setTimeout(() => {
        t.remove();
        if (!toastsEl.children.length && canPopover) {
          try { toastsEl.hidePopover(); } catch (e) { /* ignore */ }
        }
      }, 320);
    }, life);
  };

  /** Show a tip once, ever. */
  ui.hint = (id, message) => {
    if (S.flags.hintShown(id)) return;
    S.flags.setHintShown(id);
    ui.toast(message, 'tip');
  };

  /* ── Dialog plumbing ───────────────────────────────────────── */
  ui.anyDialogOpen = () => !!document.querySelector('dialog[open]');

  // Close buttons and backdrop clicks for every dialog.
  U.$$('dialog').forEach(dlg => {
    U.$$('[data-close]', dlg).forEach(b => b.addEventListener('click', () => dlg.close('cancel')));
    dlg.addEventListener('mousedown', e => {
      if (e.target !== dlg) return;
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dlg.close('cancel');
    });
  });

  /** Open a modal and resolve with its returnValue when it closes. */
  function ask(dlg, setup) {
    return new Promise(resolve => {
      if (setup) setup();
      dlg.returnValue = '';
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        resolve(dlg.returnValue || 'cancel');
      };
      dlg.addEventListener('close', onClose);
      if (!dlg.open) dlg.showModal();
    });
  }

  /* ── Confirm ───────────────────────────────────────────────── */
  ui.confirm = async (message, opts) => {
    const o = opts || {};
    const dlg = U.$('#confirmDlg');
    const okBtn = U.$('#confirmOk');
    const answer = await ask(dlg, () => {
      U.$('#confirmMsg').textContent = message;
      okBtn.textContent = o.ok || 'Confirm';
      okBtn.classList.toggle('btn-danger', !!o.danger);
      okBtn.classList.toggle('btn-primary', !o.danger);
      // Safe actions take Enter; destructive ones start on Cancel.
      requestAnimationFrame(() => (o.danger ? dlg.querySelector('[value="cancel"]') : okBtn).focus());
    });
    return answer === 'ok';
  };

  /* ── Name prompt ───────────────────────────────────────────── */
  ui.promptName = (label, initial, validate, okLabel) => {
    const dlg = U.$('#nameDlg');
    const input = U.$('#nameInput');
    const err = U.$('#nameError');
    const okBtn = U.$('#nameOk');
    return new Promise(resolve => {
      U.$('#nameLabel').textContent = label;
      okBtn.textContent = okLabel || 'Save';
      input.value = initial || '';
      err.textContent = '';

      const tryOk = () => {
        const v = input.value.trim();
        const msg = !v ? 'Please enter a name' : validate ? validate(v) : null;
        if (msg) {
          err.textContent = msg;
          input.focus();
          input.select();
          return;
        }
        dlg.close('ok');
      };
      const onClick = e => {
        e.preventDefault();
        if (e.currentTarget === okBtn) tryOk();
        else dlg.close('cancel');
      };
      const onKey = e => {
        if (e.key === 'Enter') { e.preventDefault(); tryOk(); }
      };
      const onInput = () => { err.textContent = ''; };
      const cancelBtn = dlg.querySelector('[value="cancel"]');
      okBtn.addEventListener('click', onClick);
      cancelBtn.addEventListener('click', onClick);
      input.addEventListener('keydown', onKey);
      input.addEventListener('input', onInput);
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        okBtn.removeEventListener('click', onClick);
        cancelBtn.removeEventListener('click', onClick);
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('input', onInput);
        resolve(dlg.returnValue === 'ok' ? input.value.trim() : null);
      };
      dlg.returnValue = '';
      dlg.addEventListener('close', onClose);
      dlg.showModal();
      input.focus();
      input.select();
    });
  };

  // Checked as it will be saved: trimmed and cut to 100 characters.
  const nameTakenMessage = n => (S.nameTaken(String(n).trim().slice(0, 100).trim()) ? 'A session with that name already exists' : null);

  /* ── Unsaved changes ───────────────────────────────────────── */
  function savePrompt(name) {
    return ask(U.$('#savePromptDlg'), () => {
      U.$('#savePromptMsg').textContent = 'Save changes to “' + name + '”?';
      requestAnimationFrame(() => U.$('#savePromptDlg [value="save"]').focus());
    });
  }

  /**
   * Run `proceed` once unsaved edits are dealt with: Save, Save as,
   * Don't save (revert), or Cancel (don't proceed). Resolves true if it ran.
   */
  ui.guardUnsaved = async proceed => {
    if (!A.isDirty()) {
      proceed();
      return true;
    }
    const ses = S.activeSession();
    const choice = await savePrompt(ses.name);
    if (choice === 'cancel') return false;
    let discardAfter = null;
    if (choice === 'save') {
      A.save();
      ui.toast('Saved “' + ses.name + '”', 'success');
    } else if (choice === 'discard') {
      const r = A.revert();
      if (!r.ok) {
        // The only session, never saved: it can go once there's another to fall back on.
        if (r.reason === 'last') discardAfter = ses.id;
        else { ui.toast(r.message); return false; }
      }
    } else if (choice === 'saveas') {
      const name = await ui.promptName('Save session as', A.suggestCopyName(ses.name), nameTakenMessage);
      if (!name) return false;
      const r = A.saveAs(name);
      if (!r.ok) { ui.toast(r.message); return false; }
      ui.toast('Saved as “' + r.session.name + '”', 'success');
    }
    proceed();
    if (discardAfter && S.state.activeSessionId !== discardAfter && S.sessionById(discardAfter)) {
      A.deleteSession(discardAfter);
    }
    return true;
  };

  ui.nameTakenMessage = nameTakenMessage;
})(window.JP = window.JP || {});
