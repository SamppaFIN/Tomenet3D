/**
 * MarkdownRenderer - Simple markdown parser for tooltips and labels
 * Supports basic markdown syntax, emojis, and icons
 */
export class MarkdownRenderer {
    /**
     * Convert markdown text to HTML
     * @param {string} markdown - Markdown text to parse
     * @returns {string} HTML string
     */
    static render(markdown) {
        if (!markdown) return '';
        
        let html = markdown;
        
        // Escape HTML to prevent XSS
        html = this.escapeHtml(html);
        
        // Parse markdown syntax
        html = this.parseBold(html);
        html = this.parseItalic(html);
        html = this.parseCode(html);
        html = this.parseLinks(html);
        html = this.parseLineBreaks(html);
        
        // Parse emojis (Unicode emojis pass through, but we can also support :emoji: syntax)
        html = this.parseEmojis(html);
        
        // Parse icons
        html = this.parseIcons(html);
        
        return html;
    }
    
    /**
     * Escape HTML special characters
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Parse bold text: **text** or __text__
     */
    static parseBold(text) {
        return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                   .replace(/__(.+?)__/g, '<strong>$1</strong>');
    }
    
    /**
     * Parse italic text: *text* or _text_
     */
    static parseItalic(text) {
        // First handle bold (double asterisks/underscores), then italic (single)
        // Process italic after bold to avoid conflicts
        // Use a simpler approach: single asterisk/underscore not preceded or followed by another
        return text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
                   .replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');
    }
    
    /**
     * Parse inline code: `code`
     */
    static parseCode(text) {
        return text.replace(/`(.+?)`/g, '<code>$1</code>');
    }
    
    /**
     * Parse links: [text](url)
     */
    static parseLinks(text) {
        return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }
    
    /**
     * Parse line breaks: \n or double space + \n
     */
    static parseLineBreaks(text) {
        return text.replace(/\n\n/g, '</p><p>')
                   .replace(/\n/g, '<br>');
    }
    
    /**
     * Parse emoji shortcuts: :smile:, :heart:, etc.
     * Also preserves Unicode emojis
     */
    static parseEmojis(text) {
        const emojiMap = {
            ':smile:': '😊',
            ':heart:': '❤️',
            ':star:': '⭐',
            ':fire:': '🔥',
            ':thumbsup:': '👍',
            ':thumbsdown:': '👎',
            ':check:': '✅',
            ':cross:': '❌',
            ':warning:': '⚠️',
            ':info:': 'ℹ️',
            ':question:': '❓',
            ':exclamation:': '❗',
            ':lightbulb:': '💡',
            ':rocket:': '🚀',
            ':gem:': '💎',
            ':sparkles:': '✨',
            ':rainbow:': '🌈',
            ':sun:': '☀️',
            ':moon:': '🌙',
            ':earth:': '🌍',
            ':flower:': '🌸',
            ':butterfly:': '🦋',
            ':dragon:': '🐉',
            ':unicorn:': '🦄'
        };
        
        let result = text;
        for (const [key, value] of Object.entries(emojiMap)) {
            result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        
        return result;
    }
    
    /**
     * Parse icon shortcuts: :icon-name:
     * Returns HTML entities or Unicode symbols
     */
    static parseIcons(text) {
        const iconMap = {
            ':arrow-right:': '→',
            ':arrow-left:': '←',
            ':arrow-up:': '↑',
            ':arrow-down:': '↓',
            ':checkmark:': '✓',
            ':cross-mark:': '✗',
            ':plus:': '+',
            ':minus:': '−',
            ':multiply:': '×',
            ':divide:': '÷',
            ':equals:': '=',
            ':infinity:': '∞',
            ':pi:': 'π',
            ':sum:': '∑',
            ':integral:': '∫',
            ':square:': '□',
            ':circle:': '○',
            ':triangle:': '△',
            ':diamond:': '◇',
            ':star-icon:': '★',
            ':sun-icon:': '☼',
            ':moon-icon:': '☾',
            ':heart-icon:': '♥',
            ':spade:': '♠',
            ':club:': '♣',
            ':music:': '♫',
            ':copyright:': '©',
            ':registered:': '®',
            ':trademark:': '™'
        };
        
        let result = text;
        for (const [key, value] of Object.entries(iconMap)) {
            result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<span class="icon">${value}</span>`);
        }
        
        return result;
    }
    
    /**
     * Wrap content in paragraph tags if needed
     */
    static wrapInParagraph(html) {
        if (!html) return '';
        if (html.startsWith('<p>') || html.startsWith('<strong>') || html.startsWith('<em>') || html.startsWith('<code>')) {
            return html;
        }
        return `<p>${html}</p>`;
    }
}
