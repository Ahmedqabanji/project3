console.log("📦 JS loaded");

// Get CSRF token
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
const csrftoken = getCookie('csrftoken');

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
  document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
  document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
  document.querySelector('#compose').addEventListener('click', compose_email);
  document.querySelector('#compose-form').addEventListener('submit', send_email);
  load_mailbox('inbox');
});

function compose_email() {
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#email-detail-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'block';

  document.querySelector('#compose-recipients').value = '';
  document.querySelector('#compose-subject').value = '';
  document.querySelector('#compose-body').value = '';
}

function send_email(event) {
  event.preventDefault();

  const recipients = document.querySelector('#compose-recipients').value.trim();
  const subject = document.querySelector('#compose-subject').value.trim();
  const body = document.querySelector('#compose-body').value.trim();

  if (!recipients || !subject || !body) {
    alert('جميع الحقول مطلوبة!');
    return;
  }

  fetch('/emails', {
    method: 'POST',
    headers: { 'X-CSRFToken': csrftoken },
    body: JSON.stringify({ recipients, subject, body })
  })
    .then(response => response.json())
    .then(result => {
      console.log("🎯 Send result:", result);
      if (result.error) {
        alert("❌ Error: " + result.error);
      } else {
        alert("📨 Email sent successfully!");
        load_mailbox('sent');
      }
    });
}

function load_mailbox(mailbox) {
  document.querySelector('#emails-view').style.display = 'block';
  document.querySelector('#compose-view').style.display = 'none';
  document.querySelector('#email-detail-view').style.display = 'none';

  document.querySelector('#emails-view').innerHTML = `<h3>${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>`;

  fetch(`/emails/${mailbox}`)
    .then(response => response.json())
    .then(emails => {
      emails.forEach(email => {
        const element = document.createElement('div');
        element.className = 'email-entry';
        element.style.border = '1px solid #ccc';
        element.style.padding = '10px';
        element.style.margin = '5px';
        element.style.cursor = 'pointer';
        element.style.backgroundColor = email.read ? '#f0f0f0' : 'white';

        element.innerHTML = `
          <strong>${email.sender}</strong> - ${email.subject}
          <span style="float:right;">${email.timestamp}</span>
        `;

        element.addEventListener('click', () => load_email(email.id));
        document.querySelector('#emails-view').append(element);
      });
    });
}

function load_email(id) {
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'none';
  document.querySelector('#email-detail-view').style.display = 'block';

  fetch(`/emails/${id}`)
    .then(response => response.json())
    .then(email => {
      const detailView = document.querySelector('#email-detail-view');
      detailView.innerHTML = `
        <p><strong>From:</strong> ${email.sender}</p>
        <p><strong>To:</strong> ${email.recipients.join(', ')}</p>
        <p><strong>Subject:</strong> ${email.subject}</p>
        <p><strong>Timestamp:</strong> ${email.timestamp}</p>
        <hr>
        <p>${email.body.replace(/\n/g, '<br>')}</p>
        <hr>
        <button id="reply-button" class="btn btn-sm btn-outline-primary">Reply</button>
      `;

      if (!email.read) {
        fetch(`/emails/${id}`, {
          method: 'PUT',
          headers: { 'X-CSRFToken': csrftoken },
          body: JSON.stringify({ read: true })
        });
      }

      if (email.sender !== document.querySelector('body').dataset.user) {
        const archiveButton = document.createElement('button');
        archiveButton.className = 'btn btn-sm btn-outline-secondary ml-2';
        archiveButton.innerText = email.archived ? 'Unarchive' : 'Archive';

        archiveButton.addEventListener('click', () => {
          fetch(`/emails/${email.id}`, {
            method: 'PUT',
            headers: { 'X-CSRFToken': csrftoken },
            body: JSON.stringify({ archived: !email.archived })
          }).then(() => load_mailbox('inbox'));
        });

        detailView.appendChild(archiveButton);
      }

      document.querySelector('#reply-button').addEventListener('click', () => {
        compose_email();
        document.querySelector('#compose-recipients').value = email.sender;
        document.querySelector('#compose-subject').value = email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`;
        document.querySelector('#compose-body').value = `\n\nOn ${email.timestamp}, ${email.sender} wrote:\n${email.body}`;
      });
    });
}
