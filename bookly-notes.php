<?php
/**
 * Plugin Name: Bookly Notes
 * Description: Ajoute un système de notes par jour dans le calendrier Bookly
 * Author: Sköpe
 * Version: 1.1
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * Création / mise à jour de la table wp_bookly_notes lors de l'activation
 */
register_activation_hook( __FILE__, 'bookly_notes_create_table' );
function bookly_notes_create_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'bookly_notes';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
      id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
      day_id VARCHAR(100) NOT NULL,
      note TEXT NOT NULL,
      location_id BIGINT(20) DEFAULT NULL,
      team_member_id BIGINT(20) DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE(day_id)
    ) $charset_collate;";

    require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
    dbDelta( $sql );
}

/**
 * Enqueue des scripts et styles dans l'admin
 */
add_action( 'admin_enqueue_scripts', 'bookly_notes_admin_scripts' );
function bookly_notes_admin_scripts( $hook ) {
    $plugin_url = plugin_dir_url( __FILE__ );

    wp_enqueue_style(
        'bookly-notes-css',
        $plugin_url . 'bookly-notes.css',
        array(),
        '1.1'
    );

    wp_enqueue_script(
        'bookly-notes-js',
        $plugin_url . 'bookly-notes.js',
        array('jquery'),
        '1.1',
        true
    );

    wp_localize_script( 'bookly-notes-js', 'BooklyNotesAjax', array(
        'ajax_url' => admin_url( 'admin-ajax.php' ),
    ) );
}

/**
 * AJAX GET : récupérer la note existante (note, location_id et team_member_id)
 */
add_action( 'wp_ajax_bookly_get_note', 'bookly_get_note_callback' );
function bookly_get_note_callback() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'bookly_notes';

    $day_id = sanitize_text_field( $_GET['day_id'] ?? '' );
    if ( ! $day_id ) {
        wp_send_json_error( array( 'message' => 'Aucun day_id fourni' ) );
    }

    $row = $wpdb->get_row(
        $wpdb->prepare( "SELECT note, location_id, team_member_id FROM $table_name WHERE day_id = %s", $day_id ),
        ARRAY_A
    );

    if ( $row === null ) {
        wp_send_json_success( array( 'note' => '', 'location_id' => null, 'team_member_id' => null ) );
    } else {
        wp_send_json_success( array(
            'note' => $row['note'],
            'location_id' => $row['location_id'],
            'team_member_id' => $row['team_member_id'],
        ) );
    }
}

/**
 * AJAX POST : sauvegarder / mettre à jour la note (incluant team_member_id)
 */
add_action( 'wp_ajax_bookly_save_note', 'bookly_save_note_callback' );
function bookly_save_note_callback() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'bookly_notes';

    $day_id = sanitize_text_field( $_POST['day_id'] ?? '' );
    $note   = sanitize_textarea_field( $_POST['note'] ?? '' );
    $location_id = ( isset( $_POST['location_id'] ) && $_POST['location_id'] !== '' ) ? intval( $_POST['location_id'] ) : null;
    $team_member_id = ( isset( $_POST['team_member_id'] ) && $_POST['team_member_id'] !== '' ) ? intval( $_POST['team_member_id'] ) : null;

    if ( ! $day_id ) {
        wp_send_json_error( array( 'message' => 'Aucun day_id fourni' ) );
    }

    $exists = $wpdb->get_var(
        $wpdb->prepare( "SELECT id FROM $table_name WHERE day_id = %s", $day_id )
    );

    if ( $exists ) {
        $res = $wpdb->update(
            $table_name,
            array(
                'note' => $note,
                'location_id' => $location_id,
                'team_member_id' => $team_member_id,
            ),
            array( 'day_id' => $day_id ),
            array( '%s', '%d', '%d' ),
            array( '%s' )
        );
        if ( $res === false ) {
            error_log( "[ERROR save_note] UPDATE ERROR: " . $wpdb->last_error );
            wp_send_json_error( array( 'message' => 'Erreur lors de la mise à jour.' ) );
        }
    } else {
        $res = $wpdb->insert(
            $table_name,
            array(
                'day_id' => $day_id,
                'note' => $note,
                'location_id' => $location_id,
                'team_member_id' => $team_member_id,
            ),
            array( '%s', '%s', '%d', '%d' )
        );
        if ( $res === false ) {
            error_log( "[ERROR save_note] INSERT ERROR: " . $wpdb->last_error );
            wp_send_json_error( array( 'message' => 'Erreur lors de l\'insertion.' ) );
        }
    }

    wp_send_json_success( array( 'message' => 'Note enregistrée.' ) );
}

/**
 * AJAX GET : récupérer la liste des locations Bookly
 */
add_action( 'wp_ajax_bookly_get_locations', 'bookly_get_locations_callback' );
function bookly_get_locations_callback() {
    global $wpdb;
    $locations_table = $wpdb->prefix . 'bookly_locations';

    $rows = $wpdb->get_results( "SELECT id, name FROM $locations_table ORDER BY name", ARRAY_A );
    wp_send_json_success( array( 'locations' => $rows ) );
}

/**
 * AJAX GET : récupérer la liste des membres d'équipe (staff) de Bookly
 */
add_action( 'wp_ajax_bookly_get_team_members', 'bookly_get_team_members_callback' );
function bookly_get_team_members_callback() {
    global $wpdb;
    $staff_table = $wpdb->prefix . 'bookly_staff';

    $rows = $wpdb->get_results( "SELECT id, full_name FROM $staff_table ORDER BY full_name", ARRAY_A );
    wp_send_json_success( array( 'team_members' => $rows ) );
}

/**
 * AJAX POST : supprimer une note
 */
add_action( 'wp_ajax_bookly_delete_note', 'bookly_delete_note_callback' );
function bookly_delete_note_callback() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'bookly_notes';

    $day_id = sanitize_text_field( $_POST['day_id'] ?? '' );
    if ( ! $day_id ) {
        wp_send_json_error( array( 'message' => 'Aucun day_id fourni' ) );
    }

    $res = $wpdb->delete(
        $table_name,
        array( 'day_id' => $day_id ),
        array( '%s' )
    );
    if ( $res === false ) {
        error_log( "[ERROR delete_note] DELETE ERROR: " . $wpdb->last_error );
        wp_send_json_error( array( 'message' => 'Erreur lors de la suppression.' ) );
    }
    wp_send_json_success( array( 'message' => 'Note supprimée.' ) );
}

/**
 * Enqueue des scripts externes pour Select2
 */
function admin_enqueue_scripts_callback(){
    wp_enqueue_style( 'select2-css', 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css', array(), '4.1.0-rc.0');
    wp_enqueue_script( 'select2-js', 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js', 'jquery', '4.1.0-rc.0');
    wp_enqueue_script( 'select2-init', '/wp-content/plugins/select-2-tutorial/select2-init.js', 'jquery', '4.1.0-rc.0');
}

add_action( 'admin_enqueue_scripts', 'admin_enqueue_scripts_callback' );