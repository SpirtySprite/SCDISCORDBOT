document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('id');

    const chatArea = document.getElementById('chat-area');
    const channelNameEl = document.getElementById('channel-name');
    const ticketMetaEl = document.getElementById('ticket-meta');

    if (!ticketId) {
        showError('Aucun ID de ticket fourni.');
        return;
    }

    try {
        const response = await fetch(`/api/transcripts/${ticketId}`);
        if (!response.ok) {
            throw new Error(`Transcript introuvable (${response.status})`);
        }

        const data = await response.json();
        renderTranscript(data);
    } catch (error) {
        console.error('Erreur lors du chargement du transcript:', error);
        showError(error.message);
    }

    function showError(message) {
        chatArea.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle fa-2x"></i>
                <p style="margin-top: 1rem;">${escapeHtml(message)}</p>
            </div>
        `;
    }

    function renderTranscript(data) {

        channelNameEl.textContent = data.channel_name || `Ticket ${data.ticket_id}`;

        const date = new Date(data.created_at).toLocaleString('fr-FR', {
            dateStyle: 'full', timeStyle: 'short'
        });
        ticketMetaEl.textContent = `Fermé par ${data.closed_by || 'Inconnu'} • ${date}`;


        chatArea.innerHTML = '';


        if (!data.messages || data.messages.length === 0) {
            chatArea.innerHTML = '<div class="loading">Aucun message dans ce transcript.</div>';
            return;
        }


        const userMap = new Map();
        data.messages.forEach(msg => {
            if (msg.author && msg.author.id && msg.author.username) {
                userMap.set(msg.author.id, msg.author.username);
            }
        });

        let previousAuthorId = null;

        data.messages.forEach((msg, index) => {
            const msgEl = document.createElement('div');

            const isGroupStart = msg.author.id !== previousAuthorId;
            previousAuthorId = msg.author.id;

            msgEl.className = isGroupStart ? 'message group-start' : 'message';


            const avatarUrl = msg.author?.avatar
                ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                : 'https://cdn.discordapp.com/embed/avatars/0.png';

            const isBot = msg.author?.bot;


            const dateObj = new Date(msg.timestamp);
            const today = new Date();
            const isToday = dateObj.getDate() === today.getDate() &&
                dateObj.getMonth() === today.getMonth() &&
                dateObj.getFullYear() === today.getFullYear();

            const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = isToday ? `Aujourd'hui à ${timeStr}` : dateObj.toLocaleString('fr-FR', {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });


            let contentVal = msg.content || '';
            let contentHtml = escapeHtml(contentVal);
            contentHtml = parseMarkdown(contentHtml);
            contentHtml = parseMentions(contentHtml, userMap);



            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const mediaPreviews = [];


            const matches = contentVal.match(urlRegex);
            if (matches) {
                matches.forEach(url => {
                    const isTenor = url.includes('tenor.com');
                    if (!isTenor) {
                        if (isImageUrl(url)) {
                            mediaPreviews.push(`<div class="attachment"><img src="${url}" alt="Image" onclick="window.openLightbox('${url}')"></div>`);
                        } else if (isVideoUrl(url)) {
                            mediaPreviews.push(`<div class="attachment"><video controls src="${url}"></video></div>`);
                        }
                    }
                });
            }


            contentHtml = contentHtml.replace(urlRegex, (url) => {
                return `<a href="${url}" target="_blank" class="attachment-link">${url}</a>`;
            });



            let attachmentHtml = '';
            if (msg.attachments && msg.attachments.length > 0) {
                msg.attachments.forEach(att => {
                    const isImg = att.contentType?.startsWith('image/') || isImageUrl(att.url);
                    const isVid = att.contentType?.startsWith('video/') || isVideoUrl(att.url);

                    if (isImg) {
                        attachmentHtml += `<div class="attachment"><img src="${att.url}" alt="${escapeHtml(att.name || 'Image')}" onclick="window.openLightbox('${att.url}')"></div>`;
                    } else if (isVid) {
                        attachmentHtml += `<div class="attachment"><video controls src="${att.url}"></video></div>`;
                    } else {
                        attachmentHtml += `<div class="attachment"><a href="${att.url}" target="_blank" class="attachment-link">📁 ${escapeHtml(att.name || 'Fichier')}</a></div>`;
                    }
                });
            }


            let previewHtml = '';
            if (msg.previews && msg.previews.length > 0) {
                msg.previews.forEach(prev => {
                    if (prev.type === 'video/mp4') {
                        previewHtml += `<div class="attachment"><video controls src="${prev.local_url}" autoplay loop muted></video></div>`;
                    } else {
                        previewHtml += `<div class="attachment"><img src="${prev.local_url}" alt="GIF" onclick="window.openLightbox('${prev.local_url}')"></div>`;
                    }
                });
            }


            let embedHtml = '';
            if (msg.embeds && msg.embeds.length > 0) {
                msg.embeds.forEach(embed => {
                    embedHtml += renderEmbed(embed, userMap);
                });
            }


            const allMediaHtml = [...mediaPreviews, attachmentHtml, previewHtml].join('');

            msgEl.innerHTML = `
                <img src="${avatarUrl}" class="avatar" alt="Avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                <div class="message-content">
                    <div class="message-header">
                        <span class="username ${isBot ? 'bot' : ''}">
                            ${escapeHtml(msg.author?.username || 'Inconnu')}
                            ${isBot ? '<span class="bot-tag"><i class="fas fa-check" style="font-size: 0.5rem; margin-right: 2px; display:none;"></i>BOT</span>' : ''}
                        </span>
                        <span class="timestamp">${dateStr}</span>
                    </div>
                    ${contentVal ? `<div class="text">${contentHtml}</div>` : ''}
                    ${allMediaHtml ? `<div class="attachments-container">${allMediaHtml}</div>` : ''}
                    ${embedHtml}
                </div>
            `;

            chatArea.appendChild(msgEl);
        });


        window.scrollTo(0, document.body.scrollHeight);
    }

    function isImageUrl(url) {
        return /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(url);
    }

    function isVideoUrl(url) {
        return /\.(mp4|webm|mov)($|\?)/i.test(url);
    }

    function renderEmbed(embed, userMap) {
        const color = embed.color ? intToHex(embed.color) : '#202225';

        let html = `<div class="embed" style="border-left-color: ${color};">`;


        if (embed.author) {
            html += `<div class="embed-author">`;
            if (embed.author.icon_url) {
                html += `<img src="${embed.author.icon_url}" alt="">`;
            }
            html += `<span>${escapeHtml(embed.author.name)}</span></div>`;
        }


        if (embed.title) {
            if (embed.url) {
                html += `<a href="${embed.url}" target="_blank" class="embed-title" style="text-decoration:none; color:var(--text-link);">${escapeHtml(embed.title)}</a>`;
            } else {
                html += `<span class="embed-title">${escapeHtml(embed.title)}</span>`;
            }
        }


        if (embed.description) {
            let desc = escapeHtml(embed.description);
            desc = parseMarkdown(desc);
            desc = parseMentions(desc, userMap);
            html += `<div class="embed-description">${desc}</div>`;
        }


        if (embed.fields && embed.fields.length > 0) {
            html += `<div class="embed-fields">`;
            embed.fields.forEach(field => {
                let value = escapeHtml(field.value);
                value = parseMarkdown(value);
                value = parseMentions(value, userMap);
                html += `
                    <div class="embed-field ${field.inline ? 'inline' : ''}">
                        <div class="embed-field-name">${escapeHtml(field.name)}</div>
                        <div class="embed-field-value">${value}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }


        if (embed.thumbnail && embed.thumbnail.url) {
            html += `<img src="${embed.thumbnail.url}" class="embed-thumbnail" alt="">`;
        }


        if (embed.image && embed.image.url) {
            html += `<div class="embed-image"><img src="${embed.image.url}" alt=""></div>`;
        }


        if (embed.footer || embed.timestamp) {
            html += `<div class="embed-footer">`;
            if (embed.footer && embed.footer.icon_url) {
                html += `<img src="${embed.footer.icon_url}" alt="">`;
            }
            if (embed.footer) {
                html += `<span>${escapeHtml(embed.footer.text)}</span>`;
            }

            if (embed.timestamp) {
                if (embed.footer) html += `<span style="margin: 0 4px;">•</span>`;
                const ts = new Date(embed.timestamp).toLocaleString('fr-FR');
                html += `<span>${ts}</span>`;
            }
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function parseMarkdown(text) {
        if (!text) return '';


        text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');


        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic
        text = text.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
        text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

        // Strikethrough
        text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Spoilers
        text = text.replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');

        return text;
    }

    function parseMentions(text, userMap) {
        if (!text) return '';



        return text.replace(/&lt;@!?(\d+)&gt;/g, (match, id) => {
            const username = userMap && userMap.get(id);
            if (username) {
                return `<span class="mention">@${escapeHtml(username)}</span>`;
            } else {
                return `<span class="mention">@Utilisateur</span>`;
            }
        });


        text = text.replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="mention">@Role</span>');


        text = text.replace(/&lt;#(\d+)&gt;/g, '<span class="mention">#channel</span>');

        return text;
    }

    function intToHex(intColor) {
        if (!intColor) return '#202225';
        return '#' + (intColor >>> 0).toString(16).padStart(6, '0');
    }


    const lightboxHtml = `
        <div id="lightbox-overlay" class="lightbox-overlay" onclick="window.closeLightbox()">
            <img id="lightbox-image" class="lightbox-content" src="" alt="Full size" onclick="event.stopPropagation()">
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', lightboxHtml);

    const lightboxOverlay = document.getElementById('lightbox-overlay');
    const lightboxImage = document.getElementById('lightbox-image');

    window.openLightbox = function (url) {
        lightboxImage.src = url;
        lightboxOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeLightbox = function () {
        lightboxOverlay.classList.remove('active');
        setTimeout(() => {
            lightboxImage.src = '';
        }, 200);
        document.body.style.overflow = '';
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightboxOverlay.classList.contains('active')) {
            window.closeLightbox();
        }
    });
});