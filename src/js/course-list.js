/*
 *  This file contains the events and functions applied to
 *  the course list
 */

$(() => {
    /*
        Click event to sort the course list
     */
    $('#course-list th:not(:last)').on('click', function () {
        var isAscending = false,
            isDescending = false;
        var $items = retrieveColumnItems($(this));

        if ($(this).hasClass('ascending')) {
            isAscending = true;
        } else if ($(this).hasClass('descending')) {
            isDescending = true;
        }

        $('#course-list th').removeClass('ascending descending');

        // Sort the course list in ascending, descending or the default order
        if (!isAscending && !isDescending) {
            $items.sort(function (a, b) {
                return $(a).text() > $(b).text() ? 1 : -1;
            });

            $(this).addClass('ascending');
        } else if (isAscending && !isDescending) {
            $items.sort(function (a, b) {
                return $(a).text() < $(b).text() ? 1 : -1;
            });

            $(this).addClass('descending');
        } else {
            $items.sort(function (a, b) {
                return $(a).parent().data('course') >
                    $(b).parent().data('course')
                    ? 1
                    : -1;
            });
        }

        var sortedRows = $items.map(function (i, item) {
            return $(item).parent()[0];
        });

        $('#course-list tbody tr').remove();
        $('#course-list tbody').append(sortedRows);
    });

    /*
        Click event to delete a course from the course list
     */
    $('#course-list').on('click', '.close', function () {
        var course = $(this).closest('tr').attr('data-course');

        removeCourseFromCourseList(course);
        removeCourseFromTimetable(course);

        var courseId = Number(course.split(/(\d+)/)[1]);
        for (var i = 0; i < activeTable.data.length; ++i) {
            if (activeTable.data[i].courseId == courseId) {
                activeTable.data.splice(i, 1);
                break;
            }
        }
    });

    /*
        Click event to toggle course visibility (Eye Icon)
     */
    $('#course-list').on('click', '.course-visibility-toggle', function () {
        var $row = $(this).closest('tr');
        var courseKey = $row.attr('data-course');
        var courseId = Number(courseKey.split(/(\d+)/)[1]);

        // Find the course object in state
        var courseObj = null;
        for (var i = 0; i < activeTable.data.length; ++i) {
            if (activeTable.data[i].courseId === courseId) {
                courseObj = activeTable.data[i];
                break;
            }
        }
        if (!courseObj) return;

        // Toggle the isHidden flag
        courseObj.isHidden = !courseObj.isHidden;

        if (courseObj.isHidden) {
            // Hide: fade the row, swap icon, remove from timetable, subtract credits
            $row.css('opacity', '0.5').attr('data-hidden', 'true');
            $(this).removeClass('fa-eye').addClass('fa-eye-slash');
            removeCourseFromTimetable(courseKey);
        } else {
            // Show: restore row, swap icon, re-render on timetable, re-add credits
            $row.css('opacity', '').attr('data-hidden', 'false');
            $(this).removeClass('fa-eye-slash').addClass('fa-eye');
            addCourseToTimetable(courseObj);
        }

        updateCredits();
    });

    /*
        Change event for inline slot-swap dropdowns in the course list
     */
    $('#course-list').on('change', '.slot-swap-select', function () {
        var newSlot = $(this).val();
        var courseId = Number($(this).data('course-id'));
        var courseKey = 'course' + courseId;

        // Find the course in state
        var courseObj = null;
        for (var i = 0; i < activeTable.data.length; ++i) {
            if (activeTable.data[i].courseId === courseId) {
                courseObj = activeTable.data[i];
                break;
            }
        }
        if (!courseObj) return;

        // Resolve the available slots array: typed arrays take priority over legacy flat array
        var availPool =
            courseObj.availableTheorySlots ||
            courseObj.availableLabSlots ||
            courseObj.availableSlots ||
            [];

        // Find the matching slot entry
        var newEntry = null;
        for (var j = 0; j < availPool.length; ++j) {
            if (availPool[j].slot === newSlot) {
                newEntry = availPool[j];
                break;
            }
        }
        if (!newEntry) return;

        // Build new slots array (supports compound slots like A1+TA1 or L49+L50)
        var newSlots = newSlot.split(/\s*\+\s*/).filter(Boolean);

        // Update the state object
        courseObj.slots = newSlots;
        courseObj.faculty = newEntry.faculty;
        courseObj.venue = newEntry.venue;

        // Update Faculty and Venue cells in the table row
        var $row = $(this).closest('tr');
        $row.find('td').eq(getColumnIndex('Faculty')).text(newEntry.faculty);
        $row.find('td').eq(getColumnIndex('Venue')).text(newEntry.venue);

        // Re-render timetable for this course (skip if hidden)
        if (!courseObj.isHidden) {
            removeCourseFromTimetable(courseKey);
            addCourseToTimetable(courseObj);
        }
    });

    /*
        Double click event to add a course back to the panel
     */
    $('#course-list').on('dblclick', 'tbody tr', function (e) {
        var $slotCell = $(this)
            .find('td')
            .not('[colspan]')
            .eq(getColumnIndex('Slot'));
        // If the cell contains a swap dropdown, read the current value; otherwise use text
        var $slotSelect = $slotCell.find('.slot-swap-select');
        var slotString = $slotSelect.length
            ? $slotSelect.val()
            : $slotCell.text();
        var courseCode = $(this)
            .find('td')
            .eq(getColumnIndex('Course Code'))
            .text();
        var courseTitle = $(this)
            .find('td')
            .eq(getColumnIndex('Course Title'))
            .text();
        var faculty = $(this).find('td').eq(getColumnIndex('Faculty')).text();
        var venue = $(this).find('td').eq(getColumnIndex('Venue')).text();
        var credits = $(this).find('td').eq(getColumnIndex('Credits')).text();

        $('#course-input').val(courseCode + ' - ' + courseTitle);
        $('#faculty-input').val(faculty);
        $('#slot-input').val(slotString);
        $('#venue-input').val(venue);
        $('#credits-input').val(credits);

        addSlotButtons(courseCode);

        // Scroll back to the course panel and delete the course
        $('html, body')
            .animate({
                scrollTop: 0,
            })
            .promise()
            .done(() => {
                $(this).find('.close').trigger('click');
            });
    });
});

/*
    Function to get a columns index from the course list
 */
function getColumnIndex(column) {
    var columns = Array.from($('#course-list th'), function (el) {
        return el.innerText;
    });

    return columns.indexOf(column.innerText || column);
}

/*
    Function to retrieve items from a column in the course list
 */
function retrieveColumnItems($column) {
    var index = getColumnIndex($column.text());

    var $rows = $('#course-list tbody tr');

    var items = $rows.map(function (i, row) {
        return $(row).find('td')[index];
    });

    return items;
}

/*
    Function to update the total credits.
    - Skips rows where data-hidden="true" (visibility-toggled off).
    - Deduplicates by Course Code so embedded theory+lab pairs
      (same course code, two rows) are only counted once.
 */
function updateCredits() {
    var totalCredits = 0;
    var seenCodes = new Set();
    var codeColIdx = getColumnIndex('Course Code');
    var credColIdx = getColumnIndex('Credits');

    $('#course-list tbody tr').each(function () {
        // Skip rows hidden by the visibility toggle
        if ($(this).attr('data-hidden') === 'true') return;

        var courseCode = $(this).children('td').eq(codeColIdx).text().trim();

        // Skip if we've already counted credits for this course code
        if (courseCode && seenCodes.has(courseCode)) return;

        if (courseCode) seenCodes.add(courseCode);

        totalCredits += Number($(this).children('td').eq(credColIdx).text());
    });

    $('#total-credits').text(totalCredits);
}

/*
    Function to insert a course into the course list
 */
window.addCourseToCourseList = (courseData) => {
    // ── Build Slot cell ──────────────────────────────────────────────────────
    // Use typed available-slots arrays (new) or legacy flat array (old saves).
    // Theory rows use availableTheorySlots; lab rows use availableLabSlots.
    var availPool =
        courseData.availableTheorySlots ||
        courseData.availableLabSlots ||
        courseData.availableSlots ||
        [];
    var slotCellHtml;

    if (availPool.length > 0) {
        var currentSlotKey = courseData.slots.join('+');
        var optionsHtml = availPool
            .map(function (s) {
                var selected = s.slot === currentSlotKey ? ' selected' : '';
                return `<option value="${s.slot}"${selected}>${s.slot} — ${s.faculty}</option>`;
            })
            .join('');
        slotCellHtml = `<select class="form-select form-select-sm slot-swap-select" data-course-id="${courseData.courseId}">${optionsHtml}</select>`;
    } else {
        slotCellHtml = courseData.slots.join('+');
    }

    // ── Visibility icon ──────────────────────────────────────────────────────
    var isHidden = courseData.isHidden === true;
    var eyeIconClass = isHidden ? 'fa-eye-slash' : 'fa-eye';
    var rowOpacity = isHidden ? 'opacity: 0.5;' : '';
    var dataHidden = isHidden ? 'true' : 'false';

    var $courseListItem = $(
        `<tr
            data-course="course${courseData.courseId}"
            data-is-project="${courseData.isProject}"
            data-hidden="${dataHidden}"
            style="${rowOpacity}"
        >
            <td>${slotCellHtml}</td>
            <td>${courseData.courseCode}</td>
            <td>${courseData.courseTitle}</td>
            <td>${courseData.faculty}</td>
            <td>${courseData.venue}</td>
            <td>${courseData.credits}</td>
            <td class="text-center"><i class="fas ${eyeIconClass} course-visibility-toggle" style="cursor:pointer;" title="Toggle visibility"></i></td>
            <td><i class="fas fa-times close"></i></td>
        </tr>`,
    );

    var nextRow = null;
    var sortedColumn =
        $('#course-list th.ascending')[0] || $('#course-list th.descending')[0];
    var isAscending = $('#course-list th.ascending')[0] != undefined;

    /*
        If the course list is sorted, the course should be
        inserted at the appropriate position
     */
    if (sortedColumn != undefined) {
        var index = getColumnIndex(sortedColumn);
        var $items = retrieveColumnItems($(sortedColumn));
        var currentItem = $courseListItem.find('td')[index];

        for (var i = 0; i < $items.length; i++) {
            var item = $items[i];

            if (isAscending) {
                if ($(currentItem).text() <= $(item).text()) {
                    nextRow = $(item).parent();
                    break;
                }
            } else {
                if ($(currentItem).text() >= $(item).text()) {
                    nextRow = $(item).parent();
                    break;
                }
            }
        }
    }

    if (nextRow === null) {
        $('#course-list tbody').append($courseListItem);
    } else {
        nextRow.before($courseListItem);
    }

    updateCredits();
};

/*
    Function to remove a course from the course list
 */
function removeCourseFromCourseList(course) {
    $(`#course-list tbody tr[data-course="${course}"]`).remove();
    updateCredits();
}

/*
    Function to clear the course list from the body but not delete it's data
 */
window.clearCourseList = () => {
    if ($('#course-list tbody tr[data-course]')) {
        $('#course-list tbody tr[data-course]').remove();
    }

    updateCredits();
};
