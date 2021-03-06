///
// Client - Event Listeners
///
import { ProseMeteorDoc } from 'meteor/prosemeteor:prosemirror';

// Memo List event listeners
Template.memo_list.events({
    'click .js-show-new-memo-modal': function (event) {
        // Show the New Memo Modal
        $('#new_memo_modal').modal('show');
    },
    'change #view_selector': function (event) {
        var target = event.target;

        // Get the new view
        var new_view = $(target).val();
        Session.set("view", new_view);
    },
    'change #sort_selector': function (event) {
        var target = event.target;

        // Get the new sort
        var new_sort = $(target).val();
        Session.set("sort", new_sort);
    },
    'submit #new_memo_form': function (event) {
        var target = event.target;
        event.preventDefault();

        // Get the new memo name
        var new_memo_name = target.new_memo_name.value;

        if (!/^[-.:,'A-Za-z0-9 ]+$/.test(new_memo_name)) {
            // Display an error if the memo name is not alphanumeric
            $("#new_memo_form").addClass("has-error");
            $("#memo_name_help").text("Memo name contains invalid characters.");
        } else if (Memos.findOne({ memo_name: new_memo_name })) {
            // If the memo already exists, display an error in the form
            $("#new_memo_form").addClass("has-error");
            $("#memo_name_help").text("A memo with that name already exists.");
        } else {
            // Insert new memo into collection
            var user_id = Meteor.userId();
            var new_memo_id = Memos.insert({
                memo_name: new_memo_name,
                memo_owner_id: user_id,
                memo_owner_email: Meteor.users.findOne({ _id: user_id }).emails[0].address,
                shared_with_everyone: false,
                shared_with: [],
                tags: [],
                date_created: new Date(),
                date_modified: new Date()
            });

            // Create new Prosemeteor doc
            var new_doc = new ProseMeteorDoc(new_memo_id, Meteor.userId());

            // Hide modal and redirect to new memo
            $('#new_memo_modal')
                .on('hidden.bs.modal', function () {
                    Router.go('/memos/' + encodeURI(new_memo_name));
                })
                .modal('hide');
        }
    }
});

// Memo View event listeners
Template.memo_view.events({
    // Main memo view events
    'submit #tags_form': function (event) {
        var target = event.target;
        event.preventDefault();

        // Get memo
        var memo = Memos.findOne({ _id: target.memo_id.value });
        if (!memo) {
            // User is messing with the hidden field
            return;
        }

        // Get tag
        var tag = target.new_tag.value;

        // Upsert memo
        if (memo.tags.indexOf(tag) == -1) {
            // If the memo does not already have this tag, upsert it
            memo.tags.push(tag);
            Memos.upsert({ _id: memo._id }, memo);

            // Remove error and clear input
            $("#tag_input").val("");
        }

        return;
    },
    'click .js-remove-tag': function(event) {
        var tag     = this.toString();
        var memo_id = Template.parentData(this)['_id'];
        var memo    = Memos.findOne({_id: memo_id});

        var tag_idx = memo.tags.indexOf(tag);

        if (!tag || !memo || tag_idx < 0) {
            // User is messing with the context
            return;
        }

        // Remove user from shared_with array
        memo.tags.splice(tag_idx, 1);
        Memos.upsert({_id: memo_id}, memo);
    },

    // Delete memo modal events
    'click .js-show-delete-memo-modal': function (event) {
        $("#delete_memo_modal").modal("show");
    },
    'submit #delete_memo_form': function (event) {
        var target = event.target;
        event.preventDefault();

        // Get memo
        if (!Memos.findOne({ _id: target.memo_id.value })) {
            // User is messing with the hidden field
            return;
        }
        
        // Hide modal, remove memo, and redirect to home
        $('#delete_memo_modal')
            .on('hidden.bs.modal', function () {
                // Delete memo
                Memos.remove(target.memo_id.value);
                Router.go('/');
            })
            .modal('hide');
        
        return;
    },

    // Permissions modal events
    'click .js-show-permissions-modal': function (event) {
        $('#permissions_modal').modal('show');
    },
    'hidden.bs.modal #permissions_modal': function (event) {
        // Clear errors and input box when the permissions modal is closed
        $("#permissions_form").removeClass("has-error");
        $("#email_help").text("");
        $("#email_input").val("");

        // Clear success message when the permissions modal is closed
        $("#share_everyone_form").removeClass("has-success");
        $("#share_everyone_help").text("");
    },

    // Permissions remove user event
    'click .js-remove-user-share': function(event) {
        var user_id = this.toString();
        var user    = Meteor.users.findOne({ _id: user_id });
        var memo_id = Template.parentData(this)['_id'];
        var memo    = Memos.findOne({_id: memo_id});

        var user_idx = memo.shared_with.indexOf(user_id);

        if (!user || !memo || user_idx < 0) {
            // User is messing with the context
            return;
        }

        // Remove user from shared_with array
        memo.shared_with.splice(user_idx, 1);
        Memos.upsert({_id: memo_id}, memo);
    },

    // Permissions forms events
    'submit #permissions_form': function (event) {
        var target = event.target;
        event.preventDefault();

        // Get memo
        var memo = Memos.findOne({ _id: target.memo_id.value });
        if (!memo) {
            // User is messing with the hidden field
            return;
        }

        // Get email address
        var email = target.email_address.value;
        var user = Meteor.users.findOne({ "emails.address": email });

        if (!user) {
            // If user doesn't exist, display an error
            $("#permissions_form").addClass("has-error");
            $("#email_help").text("User not found.");
        } else if (user._id == Meteor.userId()) {
            // If the user entered themself, display an error
            $("#permissions_form").addClass("has-error");
            $("#email_help").text("You already own this memo!");
        } else if (memo.shared_with.indexOf(user._id) != -1) {
            // If the memo is already shared with the user, display an error
            $("#permissions_form").addClass("has-error");
            $("#email_help")
                .text("This memo is already shared with that user!");
        } else {
            // Upsert memo
            memo.shared_with.push(user._id);
            Memos.upsert({ _id: memo._id }, memo);

            // Remove error and clear input
            $("#permissions_form").removeClass("has-error");
            $("#email_help").text("");
            $("#email_input").val("");
        }

        return;
    },
    'submit #share_everyone_form': function (event) {
        var target = event.target;
        var is_checked = target.share_with_everyone_checkbox.checked;

        event.preventDefault();

        // Get memo
        var memo = Memos.findOne({ _id: target.memo_id.value });
        if (!memo) {
            // User is messing with the hidden field
            return;
        }

        // Upsert memo
        memo['shared_with_everyone'] = is_checked
        Memos.upsert({ _id: target.memo_id.value }, memo);

        // Indicate success
        $("#share_everyone_form").addClass("has-success");
        $("#share_everyone_help").text("Updated!");
    }
});
