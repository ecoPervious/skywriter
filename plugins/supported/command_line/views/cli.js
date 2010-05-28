/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an 'AS IS' basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is
 * Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var diff_match_patch = require('diff').diff_match_patch;

var util = require('bespin:util/util');
var catalog = require('bespin:plugins').catalog;
var console = require('bespin:console').console;

var keyutil = require('keyboard:keyutil');
var keyboardManager = require('keyboard:keyboard').keyboardManager;

var history = require('canon:history');
var environment = require('canon:environment').global;
var settings = require('settings').settings;

var Level = require('command_line:hint').Level;
var Input = require('command_line:input').Input;
var templates = require('command_line:templates');
var requestOutput = require('command_line:views/requestOutput');

var imagePath = catalog.getResourceURL('command_line') + 'images';
var diff = new diff_match_patch();

/**
 * A view designed to dock in the bottom of the editor, holding the command
 * line input.
 */
exports.CliInputView = function() {
    // Used to track if we have focus, and therefore should the CLI be expanded
    // or collapsed
    this._hasFocus = false;

    // Are we currently pinned?
    this._pinned = false;

    // What should the input field look like when someone presses TAB
    this._completion = '';

    // For parsing the input
    this._input = new Input('');

    // If we discover a change in size, we need to change a few styles
    this._lastOrientation = null;

    // Elements attached to this by the templater. For info only
    this.element = null;
    this._top = null;
    this._hints = null;
    this._table = null;
    this._completer = null;
    this._inputer = null;

    templates.cli({
        cliInputView: this,
        imagePath: imagePath
    });

    keyutil.addKeyDownListener(this._inputer, function(ev) {
        environment.commandLine = this;
        var handled = keyboardManager.processKeyEvent(ev, this, {
            isCommandLine: true, isKeyUp: false
        });
        if (ev.keyCode === keyutil.KeyHelper.KEY.TAB) {
            return true;
        }
        return handled;
    }.bind(this));

    this._inputer.addEventListener('keyup', function(ev) {
        var handled = keyboardManager.processKeyEvent(ev, this, {
            isCommandLine: true, isKeyUp: true
        });

        if (ev.keyCode === keyutil.KeyHelper.KEY.RETURN) {
            this._input.execute();
            this.setInput('');
        } else {
            var typed = this._inputer.value;
            if (this._input.typed !== typed) {
                this._input = new Input(typed);
                this.hintUpdated();
            }
        }

        return handled;
    }.bind(this), true);

    catalog.registerExtension('settingChange', {
        match: '[min|max]ConsoleHeight',
        pointer: this.checkSize.bind(this)
    });

    var requestOutputHandler = requestOutput.createHandler(this);
    catalog.registerExtension('addedRequestOutput', requestOutputHandler);
};

/**
 *
 */
exports.CliInputView.prototype = {
    /**
     * See note in app.js
     */
    elementAppended: function() {
        this.checkSize();
    },

    /**
     * Perhaps this should be part of some widget superclass?
     */
    getOrientation: function() {
        var className = this.element.className;
        var north = /\bnorth\b/.test(className);
        var south = /\bsouth\b/.test(className);
        var east = /\beast\b/.test(className);
        var west = /\bwest\b/.test(className);

        if (north && !south && !east && !west) {
            return 'north';
        }
        if (!north && south && !east && !west) {
            return 'south';
        }
        if (!north && !south && east && !west) {
            return 'east';
        }
        if (!north && !south && !east && west) {
            return 'west';
        }

        throw new Error('Ambiguous orientation: north=' + north +
                ', south=' + south + ', east=' + east + ', west=' + west);
    },

    /**
     * Called whenever anything happens that could affect the output display
     */
    checkSize: function() {
        var orientation = this.getOrientation();

        if (orientation === 'north' || orientation === 'south') {
            var height = settings.get('minConsoleHeight');
            if (this._pinned || this._hasFocus) {
                height = settings.get('maxConsoleHeight');
            }

            this._table.style.height = height + 'px';
            this._top.style.height = height + 'px';

            catalog.publish(this, 'dimensionsChanged');
        }
    },

    /**
     * Apply the proposed completion
     */
    complete: function() {
        this._inputer.value = this._completion;
    },

    /**
     * Adjust the displayed input (but don't execute it)
     */
    setInput: function(command) {
        command = command || '';
        this._inputer.value = command;
        this._input = new Input(command);
        this.hintUpdated();
        this.focus();
    },

    /**
     * Push the focus into the input element
     */
    focus: function() {
        this._inputer.focus();
    },

    /**
     * Some sugar around <tt>new Input(...).execute();</tt> that is useful to
     * ensure any output is associated with this command line.
     * Note that this association isn't currently special, however it could
     * become special in the future, and this method will do it for you
     * automagically.
     */
    execute: function(command) {
        // TODO: This is a hack... how to do it right?
        environment.commandLine = this;

        var input = new Input(command);
        input.execute();
    },

    /**
     * Place a given value on the command line.
     * TODO: Perhaps we should store existing values that are on the command
     * line so that we can put them back when return is pressed?
     */
    prompt: function(command) {
        this._inputer.value = command;
    },

    /**
     * Sync the hint manually so we can also alter the sizes of the hint and
     * output components to make it fit properly.
     */
    hintUpdated: function() {
        var hints = this._input.hints;
        while (this._hints.firstChild) {
            this._hints.removeChild(this._hints.firstChild);
        }

        var level = Level.Info;
        this.setCompletion('');

        /**
         * Find a way to populate a DOM node with this hint
         */
        var addHint = function(hintNode, hint) {
            if (!hint) {
                return;
            }

            // Defer promises
            if (hint.isPromise) {
                hint.then(function(hint) {
                    addHint(hintNode, hint);
                }.bind(this));
                return;
            }

            if (!hint.element) {
                // If we have nothing to show, ignore
            } else if (hint.element.addEventListener) {
                // instanceof Node?
                hintNode.appendChild(hint.element);
            } else {
                // Maybe we should do something clever with exceptions?
                // For now we just toString and call it done.
                var parent = document.createElement('article');
                var text = hint.element.toString();
                parent.appendChild(document.createTextNode(text));
                hintNode.appendChild(parent);
            }

            this.setCompletion(hint.completion);

            if (hint.level > level) {
                level = hint.level;
            }

            util.setClass(this._inputer, 'cmd_error', level == Level.Error);
        }.bind(this);

        hints.forEach(function(hint) {
            addHint(this._hints, hint);
        }.bind(this));

        util.setClass(this._inputer, 'cmd_error', level == Level.Error);
    },

    /**
     * Scroll the output area to the bottom
     */
    scrollToBottom: function() {
        // Certain browsers have a bug such that scrollHeight is too small
        // when content does not fill the client area of the element
        var scrollHeight = Math.max(this._table.scrollHeight, this._table.clientHeight);
        this._table.scrollTop = scrollHeight - this._table.clientHeight;
    },

    /**
     *
     */
    _focusCheck: function(ev) {
        var newTarget = ev.explicitOriginalTarget;
        if (newTarget) {
            this._hasFocus = this.element == newTarget ||
                Boolean(this.element.compareDocumentPosition(newTarget) & 16);
        } else {
            this._hasFocus = (ev.type == 'focus');
        }
console.log('_focusCheck', ev, this._hasFocus);
        this.checkSize();
    },

    /**
     * onClick for the pin button in the toolbar
     */
    _togglePin: function() {
        // TODO: change the image
        this._pinned = !this._pinned;
        this.checkSize();
    },

    /**
     * We can't know where the focus is going to (willLoseKeyResponderTo only
     * reports when the destination focus is a sproutcore component that will
     * accept keyboard input - we sometimes lose focus to elements that do not
     * take input)
     */
    checkfocus: function(source, event) {
        // We don't want old blurs to happen whatever
        this._cancelBlur('focus event');

        var focus = source[event];
        if (focus) {
            // Make sure that something isn't going to undo the hasFocus=true
            this._hasFocus = true;
        } else {
            // The current element has lost focus, but does that mean that the
            // whole CliInputView has lost focus? We delay setting hasFocus to
            // false to see if anything grabs the focus

            // We rely on something canceling this if we're not to lose focus
            this._blurTimeout = window.setTimeout(function() {
                //console.log('_blurTimeout', arguments);
                this._hasFocus = false;
            }.bind(this), 1);
        }
    },

    /**
     * We need to know if blur events from the input really matter (i.e. are
     * they going to the editor or another view, or just to another part of
     * this view) so we listen for clicks in this view.
     * This allows us to cancel the effects of a blur
     *
     * We have reason to believe that a blur event shouldn't happen
     * @param {String} reason For debugging we (where we can) declare why we
     * are canceling the blur action
     */
    _cancelBlur: function(reason) {
        // console.log('_cancelBlur', arguments);
        if (this._blurTimeout) {
            window.clearTimeout(this._blurTimeout);
            this._blurTimeout = null;
        }
    },

    /**
     * Set the completion field including setting some styling to ensure that
     * everything displays properly.
     * @param completion {string} The full completion value
     */
    setCompletion: function(completion) {
        this._completion = completion || '';
        var current = this._inputer.value;

        var val;
        if (!completion) {
            val = '';
        } else if (completion.indexOf(current) === 0) {
            val = '<span class="cmd_existing">' + current +
                '</span>' + completion.substring(current.length);
        } else {
            var len = diff.diff_commonPrefix(current, completion);
            var extension = completion.substring(len);
            val = '<span class="cmd_existing">' + current + '</span>' +
                '<span class="cmd_extension">' + extension + '</span>';
        }

        this._completer.innerHTML = val;
    }
};
