<?php
/**
 * Plugin Name: Bookly Notes
 * Description: Ajoute un système de notes par jour dans le calendrier Bookly
 * Author: Sköpe
 * Version: 1.0
 */

if ( ! defined( 'WPINC' ) ) {
    die;
}

/**
 * 1) Création / mise à jour de la table wp_bookly_notes lors de l'activation
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
      PRIMARY KEY (id),
      UNIQUE(day_id)
    ) $charset_collate;";

    require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
    dbDelta( $sql );
}

/**
 * 2) Enqueue des scripts et styles dans l'admin
 */
add_action( 'admin_enqueue_scripts', 'bookly_notes_admin_scripts' );
function bookly_notes_admin_scripts( $hook ) {
    // Vous pouvez filtrer selon la page (ex: 'toplevel_page_bookly-calendar')
    $plugin_url = plugin_dir_url( __FILE__ );

    wp_enqueue_style(
        'bookly-notes-css',
        $plugin_url . 'bookly-notes.css',
        [],
        '1.1'
    );

    wp_enqueue_script(
        'bookly-notes-js',
        $plugin_url . 'bookly-notes.js',
        ['jquery'],
        '1.1',
        true
    );

    wp_localize_script( 'bookly-notes-js', 'BooklyNotesAjax', [
        'ajax_url' => admin_url( 'admin-ajax.php' ),
    ] );
}

/**
 * 3) AJAX GET : récupérer la note existante (note + location_id)
 */
add_action( 'wp_ajax_bookly_get_note', 'bookly_get_note_callback' );
function bookly_get_note_callback() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'bookly_notes';

    $day_id = sanitize_text_field( $_GET['day_id'] ?? '' );
    error_log( "[DEBUG get_note] day_id='$day_id'" );

    if ( ! $day_id ) {
        wp_send_json_error( [ 'message' => 'Aucun day_id fourni' ] );
    }

    $row = $wpdb->get_row(
        $wpdb->prepare( "SELECT note, location_id FROM $table_name WHERE day_id = %s", $day_id ),
        ARRAY_A
    );

    if ( $row === null ) {
        error_log( "[DEBUG get_note] Aucune ligne trouvée pour day_id='$day_id'" );
        wp_send_json_success( [ 'note' => '', 'location_id' => null ] );
    } else {
        error_log( "[DEBUG get_note] Trouvé => note='" . $row['note'] . "', location_id=" . $row['location_id'] );
        wp_send_json_success( [
            'note' => $row['note'],
            'location_id' => $row['location_id'],
        ] );
    }
}

/**
 * 4) AJAX POST : sauvegarder / mettre à jour la note
 */
add_action( 'wp_ajax_bookly_save_note', 'bookly_save_note_callback' );
function bookly_save_note_callback() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'bookly_notes';

    $day_id = sanitize_text_field( $_POST['day_id'] ?? '' );
    $note   = sanitize_textarea_field( $_POST['note'] ?? '' );
    $location_id = ( isset( $_POST['location_id'] ) && $_POST['location_id'] !== '' ) ? intval( $_POST['location_id'] ) : null;

    error_log( "[DEBUG save_note] day_id='$day_id', note='$note', location_id=$location_id" );

    if ( ! $day_id ) {
        wp_send_json_error( [ 'message' => 'Aucun day_id fourni' ] );
    }

    $exists = $wpdb->get_var(
        $wpdb->prepare( "SELECT id FROM $table_name WHERE day_id = %s", $day_id )
    );

    if ( $exists ) {
        $res = $wpdb->update(
            $table_name,
            [ 'note' => $note, 'location_id' => $location_id ],
            [ 'day_id' => $day_id ],
            [ '%s', '%d' ],
            [ '%s' ]
        );
        if ( $res === false ) {
            error_log( "[DEBUG save_note] UPDATE ERROR: " . $wpdb->last_error );
        } else {
            error_log( "[DEBUG save_note] UPDATE result: " . print_r($res, true) );
        }
    } else {
        $res = $wpdb->insert(
            $table_name,
            [
                'day_id' => $day_id,
                'note' => $note,
                'location_id' => $location_id,
            ],
            [ '%s', '%s', '%d' ]
        );
        if ( $res === false ) {
            error_log( "[DEBUG save_note] INSERT ERROR: " . $wpdb->last_error );
        } else {
            error_log( "[DEBUG save_note] INSERT result: " . print_r($res, true) );
        }
    }

    wp_send_json_success( [ 'message' => 'Note enregistrée.' ] );
}

/**
 * 5) AJAX GET : récupérer la liste des locations Bookly
 */
add_action( 'wp_ajax_bookly_get_locations', 'bookly_get_locations_callback' );
function bookly_get_locations_callback() {
    global $wpdb;
    $locations_table = $wpdb->prefix . 'bookly_locations';

    error_log( "[DEBUG get_locations] Début" );
    $rows = $wpdb->get_results( "SELECT id, name FROM $locations_table ORDER BY name", ARRAY_A );
    wp_send_json_success( [ 'locations' => $rows ] );
}


function admin_enqueue_scripts_callback(){

    //Add the Select2 CSS file
    wp_enqueue_style( 'select2-css', 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css', array(), '4.1.0-rc.0');

    //Add the Select2 JavaScript file
    wp_enqueue_script( 'select2-js', 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js', 'jquery', '4.1.0-rc.0');

    //Add a JavaScript file to initialize the Select2 elements
    wp_enqueue_script( 'select2-init', '/wp-content/plugins/select-2-tutorial/select2-init.js', 'jquery', '4.1.0-rc.0');

}
add_action( 'admin_enqueue_scripts', 'admin_enqueue_scripts_callback' );