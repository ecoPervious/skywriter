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

"define metadata";
({
    "description": "Constructs what you see on a hosted Bespin server",
    "dependencies": {
        "appsupport": "0.0",
        "theme_manager": "0.0",
        "traits": "0.0"
    },
    "provides": [
        {
            "ep": "appcomponent",
            "name": "environment",
            "pointer": "#hostedEnvironment"
        }
    ]
});
"end";

var SC = require('sproutcore/runtime').SC;
var Promise = require('bespin:promise').Promise;
var Trait = require('traits').Trait;

/**
 * @trait
 *
 * The environment when Bespin is hosted on the server.
 */
exports.hostedEnvironment = Trait.object({
    /**
     * @type {Array<string>}
     *
     * The component loading order in the hosted environment.
     */
    componentOrder: [
        'environment', 'login_controller', 'file_source',
        'settings', 'key_listener', 'dock_view', 'command_line', 'social_view',
        'editor_view', 'edit_session'
    ],

    /**
     * @type {SC.Pane}
     *
     * The pane in which Bespin lives.
     */
    pane: null,

    /**
     * @type {class<SC.Pane>}
     *
     * The type of the pane in which Bespin lives. This field is supplied by
     * the Bespin controller and is instantiated in the init() function.
     */
    paneClass: null,

    /** Initializes the hosted Bespin environment. */
    createPane: function() {
        var app = SC.Application.create({ NAMESPACE: 'bespin' });
        var mainPage = SC.Page.create({ pane: this.paneClass });
        app.set('mainPage', mainPage);

        var pane = mainPage.get('pane');
        this.pane = pane;
        pane.append();

        return new Promise().resolve(pane);
    },

    sessionInitialized: function(session) {}
});

