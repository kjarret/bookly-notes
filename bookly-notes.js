jQuery(document).ready(function($){
  // Dictionnaires pour locations et équipe
  let locationDict = {};
  const locationColors = {
    '5':  '#E74C3C',
    '6':  '#27AE60',
    '7':  '#2980B9',
    '8':  '#8E44AD',
    '9':  '#F1C40F',
    '10': '#16A085',
    '11': '#D35400',
    '12': '#565b61',
    '13': '#7F8C8D',
    '14': '#F39C12',
    '15': '#C0392B'
  };

  let teamDict = {};

  // SVG pour indiquer qu'une note existe (plusIcon) et pour le bouton d'ajout (addNoteIcon)
  const plusIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 26 26" fill="#FFF" style="vertical-align: middle;">
      <path d="M13.5,3.188C7.805,3.188,3.188,7.805,3.188,13.5S7.805,23.813,13.5,23.813S23.813,19.195,23.813,13.5 S19.195,3.188,13.5,3.188z M19,15h-4v4h-3v-4H8v-3h4V8h3v4h4V15z"></path>
    </svg>
  `;
  const addNoteIcon = `
    <svg width="12" height="12" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" style="margin-top:6px;margin-bottom:6px;">
      <g fill="#000" fill-rule="evenodd" stroke="none">
        <g transform="scale(10.66667,10.66667)">
          <path d="M11,2v9h-9v2h9v9h2v-9h9v-2h-9v-9z"></path>
        </g>
      </g>
    </svg>
  `;

  // Récupère la liste des locations et remplit locationDict
  function fetchAllLocations() {
    return $.ajax({
      url: BooklyNotesAjax.ajax_url,
      method: 'GET',
      data: { action: 'bookly_get_locations' },
      dataType: 'json'
    }).done(function(resp){
      if (resp.success) {
        (resp.data.locations || []).forEach(loc => {
          locationDict[loc.id] = loc.name;
        });
      } else {
        console.error("[Bookly+Notes] fetchAllLocations error:", resp.data);
      }
    }).fail(function(err){
      console.error("[Bookly+Notes] fetchAllLocations AJAX fail:", err);
    });
  }

  // Récupère la liste des membres d'équipe et stocke dans teamDict (également accessible via window.teamDict)
  function fetchAllTeamMembers() {
    return $.ajax({
      url: BooklyNotesAjax.ajax_url,
      method: 'GET',
      data: { action: 'bookly_get_team_members' },
      dataType: 'json'
    }).done(function(resp){
      if (resp.success) {
        (resp.data.team_members || []).forEach(member => {
          teamDict[member.id] = member.full_name;
        });
        window.teamDict = teamDict;
      } else {
        console.error("[Bookly+Notes] fetchAllTeamMembers error:", resp.data);
      }
    }).fail(function(err){
      console.error("[Bookly+Notes] fetchAllTeamMembers AJAX fail:", err);
    });
  }

  // Création du modal (incluant les dropdowns pour location et équipe)
  if (!$('#myModal').length) {
    $('body').append(`
      <div id="myModal" class="my-modal">
        <div class="my-modal-content">
          <span class="my-modal-close">&times;</span>
          <h3 id="myModalTitle">Titre</h3>
          <textarea id="myModalTextarea" rows="6" style="width:100%;"></textarea>
          <br/><br/>
          <label>Cabinet : </label>
          <select id="myModalLocationDropdown" style="width:100%;">
            <option value="">(Aucune)</option>
          </select>
          <br/><br/>
          <label>Équipe : </label>
          <select id="myModalTeamDropdown" style="width:100%;">
            <option value="">(Aucune)</option>
          </select>
          <br/><br/>
          <div class="button-champ">
            <button class="modal-button" id="myModalSaveBtn">Enregistrer</button>
            <button class="modal-button" id="myModalDeleteBtn">Supprimer</button>
          </div>
        </div>
      </div>
    `);
    $('#myModal .my-modal-close').on('click', () => { $('#myModal').hide(); });
    $('#myModal').on('click', function(e){
      if ($(e.target).is('#myModal')) { $('#myModal').hide(); }
    });
  }

  const $modal = $('#myModal'),
        $modalTitle = $('#myModalTitle'),
        $modalTextarea = $('#myModalTextarea'),
        $modalLocDropdown = $('#myModalLocationDropdown'),
        $modalTeamDropdown = $('#myModalTeamDropdown'),
        $modalSaveBtn = $('#myModalSaveBtn'),
        $modalDeleteBtn = $('#myModalDeleteBtn');

  let currentDayId = null,
      currentSubcell = null;

  const subcellSpinner = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <style>
        .spinner_P7sC { transform-origin: center; animation: spinner_svv2 .75s infinite linear; }
        @keyframes spinner_svv2 { 100% { transform: rotate(360deg); } }
      </style>
      <path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" class="spinner_P7sC"/>
    </svg>
  `;

  function observeHeaderCell($dayCell) {
    const timeEl = $dayCell.find('time[datetime], time[aria-label]').get(0);
    if (!timeEl) {
      console.error("[Bookly+Notes] Aucun <time> trouvé dans la cellule", $dayCell);
      return;
    }
    const observer = new MutationObserver(() => {
      $dayCell.removeClass('cells-initialized').find('.my-extra-row').remove();
      addThreeSubcellsTo($dayCell);
      observer.disconnect();
    });
    observer.observe(timeEl, { characterData: true, childList: true, subtree: true });
  }

  function addThreeSubcellsTo($dayCell) {
    $dayCell.find('.my-extra-row').remove();
    $dayCell.removeClass('cells-initialized');

    let dayId = "";
    const ariaLabel = $dayCell.find('time[aria-label]').attr('aria-label');
    if (ariaLabel) {
      dayId = moment(ariaLabel, "dddd D MMMM YYYY", "fr").format("YYYY-MM-DD");
    } else {
      dayId = ($dayCell.find('time[datetime]').attr('datetime') || "").trim();
    }
    $dayCell.addClass('cells-initialized');
    $dayCell.append(`
      <div class="my-extra-row" style="display:flex; gap:8px; margin-top:10px;">
        <div class="my-subcell" data-subcell="1">${subcellSpinner}</div>
        <div class="my-subcell" data-subcell="2">${subcellSpinner}</div>
        <div class="my-subcell" data-subcell="3">${subcellSpinner}</div>
      </div>
    `);

    for (let sc = 1; sc <= 3; sc++) {
      const $subcell = $dayCell.find(`.my-subcell[data-subcell='${sc}']`);
      const combinedId = dayId + "-" + sc;
      $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_note', day_id: combinedId },
        dataType: 'json',
        success: function(resp) {
          if (resp.success) {
            const note = resp.data.note || "";
            const locationId = resp.data.location_id || "";
            const teamMemberId = resp.data.team_member_id || "";
            let locName = locationDict[locationId] || "";
            let shortLoc = "";
            if (locName === "Genève CA") {
              shortLoc = "G_CA";
            } else if (locName === "Genève EV") {
              shortLoc = "G_EV";
            } else {
              shortLoc = locName.substring(0, 3).toUpperCase();
            }
            let teamName = (teamMemberId && window.teamDict) ? window.teamDict[teamMemberId] || "" : "";
            let hasNote = note.trim().length > 0;
            let content = shortLoc;
            if (hasNote) {
              content += plusIcon;
              $subcell.attr('data-tooltip', note);
            } else {
              $subcell.removeAttr('data-tooltip');
            }
            // Ajout du nom du staff en dessous du shortLoc (si défini)
            if (teamName) {
              content += "<span class='staff-label'>" + teamName + "</span>";
            }
            $subcell.html(content || addNoteIcon);
            if (locationId) {
              $subcell.css("background-color", locationColors[locationId] || "#DDD");
            } else {
              $subcell.css("background-color", "");
            }
          } else {
            $subcell.html(addNoteIcon);
          }
        },
        error: function(err) {
          console.error("[Bookly+Notes] GET AJAX error for combinedId =", combinedId, err);
          $subcell.html(addNoteIcon);
        }
      });
    }

    observeHeaderCell($dayCell);

    $dayCell.find('.my-subcell').on('click', function(){
      currentDayId = dayId;
      currentSubcell = $(this).attr('data-subcell');
      $modalTitle.text("Jour " + dayId + " / Sous-cell " + currentSubcell);
      $modalTextarea.val("");
      $modalLocDropdown.empty().append('<option value="">(Aucun)</option>');
      $modalTeamDropdown.empty().append('<option value="">(Aucun)</option>');
      $modal.show();
      const combinedId = dayId + "-" + currentSubcell;
      $.ajax({
        url: BooklyNotesAjax.ajax_url,
        method: 'GET',
        data: { action: 'bookly_get_note', day_id: combinedId },
        dataType: 'json',
        success: function(resp) {
          if (resp.success) {
            $modalTextarea.val(resp.data.note || "");
            const savedLocId = resp.data.location_id || "";
            const savedTeamId = resp.data.team_member_id || "";
            let locOptions = Object.keys(locationDict).map(id => {
              let color = locationColors[id] || "#000000";
              return `<option value="${id}" data-color="${color}">${locationDict[id]}</option>`;
            });
            $modalLocDropdown.append(locOptions.join(""));
            if (savedLocId) {
              $modalLocDropdown.val(savedLocId);
            }
            $modalLocDropdown.select2({
              width: 'resolve',
              dropdownParent: $modal,
              templateResult: function(option) {
                if (!option.id) return option.text;
                let col = $(option.element).data('color') || '#000000';
                return $(`
                  <span>
                    <svg width="12" height="12" style="vertical-align: middle; margin-right: 4px;">
                      <circle cx="6" cy="6" r="5" fill="${col}" />
                    </svg>
                    ${option.text}
                  </span>
                `);
              },
              templateSelection: function(option) {
                if (!option.id) return option.text;
                let col = $(option.element).data('color') || '#000000';
                return $(`
                  <span>
                    <svg width="12" height="12" style="vertical-align: middle; margin-right: 4px;">
                      <circle cx="6" cy="6" r="5" fill="${col}" />
                    </svg>
                    ${option.text}
                  </span>
                `);
              },
              escapeMarkup: function(markup) { return markup; }
            });
            // Récupère les membres d'équipe
            $.ajax({
              url: BooklyNotesAjax.ajax_url,
              method: 'GET',
              data: { action: 'bookly_get_team_members' },
              dataType: 'json',
              success: function(respTeam) {
                if (respTeam.success) {
                  let teamOptions = `<option value="">(Aucune)</option>`;
                  (respTeam.data.team_members || []).forEach(member => {
                    teamOptions += `<option value="${member.id}">${member.full_name}</option>`;
                  });
                  $modalTeamDropdown.html(teamOptions);
                  if (savedTeamId) {
                    $modalTeamDropdown.val(savedTeamId);
                  }
                  window.teamDict = {};
                  (respTeam.data.team_members || []).forEach(member => {
                    window.teamDict[member.id] = member.full_name;
                  });
                } else {
                  console.error("[Bookly+Notes] GET team_members error:", respTeam.data);
                }
              },
              error: function(err) {
                console.error("[Bookly+Notes] GET team_members AJAX error:", err);
              }
            });
          } else {
            console.error("[Bookly+Notes] GET (modal) error:", resp.data.message);
          }
        },
        error: function(err) {
          console.error("[Bookly+Notes] GET (modal) AJAX error:", err);
        }
      });
    });
  }

  $modalSaveBtn.on('click', function(){
    if (!currentDayId || !currentSubcell) {
      alert("Erreur : dayId / sous-cellule manquant");
      return;
    }
    const content = $modalTextarea.val() || "";
    const location_id = $modalLocDropdown.val() || "";
    const team_member_id = $modalTeamDropdown.val() || "";
    const combinedId = currentDayId + "-" + currentSubcell;
    $.ajax({
      url: BooklyNotesAjax.ajax_url,
      method: 'POST',
      data: {
        action: 'bookly_save_note',
        day_id: combinedId,
        note: content,
        location_id: location_id,
        team_member_id: team_member_id
      },
      dataType: 'json',
      success: function(resp) {
        if (resp.success) {
          alert("La note est sauvegardée !");
          $modal.hide();
          const $dayCell = $(`.ec-day[role="columnheader"].cells-initialized:has(time[datetime='${currentDayId}'])`);
          const $subcell = $dayCell.find(`.my-subcell[data-subcell='${currentSubcell}']`);
          let locName = locationDict[location_id] || "";
          let shortLoc = (locName === "Genève CA") ? "G_CA" : ((locName === "Genève EV") ? "G_EV" : locName.substring(0, 3).toUpperCase());
          let teamName = (team_member_id && window.teamDict) ? window.teamDict[team_member_id] || "" : "";
          let hasNote = content.trim().length > 0;
          let newHtml = shortLoc + (hasNote ? " " + plusIcon : "");
          if (teamName) {
            newHtml += "<br><span class='staff-label'>" + teamName + "</span>";
          }
          $subcell.html(newHtml || addNoteIcon);
          if (location_id) {
            $subcell.css("background-color", locationColors[location_id] || "#DDD");
          } else {
            $subcell.css("background-color", "");
          }
          if (hasNote) {
            $subcell.attr('data-tooltip', content);
          } else {
            $subcell.removeAttr('data-tooltip');
          }
        } else {
          alert("Erreur save_note => " + resp.data.message);
        }
      },
      error: function(err) {
        console.error("[Bookly+Notes] SAVE AJAX error:", err);
      }
    });
  });

  $modalDeleteBtn.on('click', function(){
    if (!currentDayId || !currentSubcell) {
      alert("Erreur : dayId / sous-cellule manquant");
      return;
    }
    if (!confirm("Confirmez-vous la suppression de cette note ?")) {
      return;
    }
    const combinedId = currentDayId + "-" + currentSubcell;
    $.ajax({
      url: BooklyNotesAjax.ajax_url,
      method: 'POST',
      data: { action: 'bookly_delete_note', day_id: combinedId },
      dataType: 'json',
      success: function(resp) {
        if (resp.success) {
          alert("Note supprimée !");
          $modal.hide();
          const $dayCell = $(`.ec-day[role="columnheader"].cells-initialized:has(time[datetime='${currentDayId}'])`);
          const $subcell = $dayCell.find(`.my-subcell[data-subcell='${currentSubcell}']`);
          $subcell.html(addNoteIcon).css("background-color", "");
          $subcell.removeAttr('data-tooltip');
        } else {
          alert("Erreur delete_note => " + resp.data.message);
        }
      },
      error: function(err) {
        console.error("[Bookly+Notes] DELETE AJAX error:", err);
      }
    });
  });

  $('.ec-prev, .ec-next').on('click', function(){
    setTimeout(function(){
      $('.ec-day[role="columnheader"]').each(function(){
        $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
      });
      addThreeSubcells();
    }, 500);
  });

  function initIntersectionObserver() {
    const observerOptions = { root: null, threshold: 0.1 };
    const intersectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          addThreeSubcellsTo($(entry.target));
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
    $('.ec-day[role="columnheader"]').each(function(){
      if (!$(this).hasClass('cells-initialized')) {
        intersectionObserver.observe(this);
      }
    });
  }

  if (typeof calendar !== 'undefined' && calendar.ec && typeof calendar.ec.refetchEvents === 'function') {
    let originalRefetch = calendar.ec.refetchEvents;
    calendar.ec.refetchEvents = function(){
      originalRefetch.apply(this, arguments);
      setTimeout(function(){
        $('.ec-day[role="columnheader"]').each(function(){
          $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
        });
        addThreeSubcells();
      }, 500);
    };
  } else {
    $(document).on('bookly_calendar_view_changed', function(){
      $('.ec-day[role="columnheader"]').each(function(){
        $(this).removeClass('cells-initialized').find('.my-extra-row').remove();
      });
      addThreeSubcells();
    });
  }

  function addThreeSubcells() {
    $('.ec-day[role="columnheader"]:not(.cells-initialized)').each(function(){
      addThreeSubcellsTo($(this));
    });
  }

  fetchAllLocations().done(function(){
    fetchAllTeamMembers().done(function(){
      initIntersectionObserver();
      setTimeout(function(){
        $('.ec-day[role="columnheader"]:not(.cells-initialized)').each(function(){
          addThreeSubcellsTo($(this));
        });
      }, 2000);
    });
  });
});
