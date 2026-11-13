package com.routewise.trip.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import com.routewise.city.TestCities;
import com.routewise.city.domain.City;
import com.routewise.city.repository.CityRepository;
import com.routewise.common.exception.ConflictException;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.common.exception.ValidationError;
import com.routewise.trip.config.TripProperties;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.dto.TripRequest;
import com.routewise.trip.dto.TripResponse;
import com.routewise.trip.dto.TripStopRequest;
import com.routewise.trip.dto.TripStopResponse;
import com.routewise.trip.mapper.TripMapper;
import com.routewise.trip.repository.TripRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Runs the real {@link StopResolver} against a mocked city repository. */
@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    private static final long OWNER_ID = 7L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 11);
    private static final LocalDate DEPARTURE = TODAY.plusDays(7);
    private static final Duration RESTORE_WINDOW = Duration.ofSeconds(30);
    private static final Clock CLOCK = Clock.fixed(TODAY.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC);

    @Mock
    private TripRepository tripRepository;

    @Mock
    private CityRepository cityRepository;

    private TripService tripService;

    private final City berlin = TestCities.berlin();
    private final City vienna = TestCities.vienna();
    private final City prague = TestCities.prague();

    @BeforeEach
    void setUp() {
        tripService = new TripService(tripRepository, new StopResolver(cityRepository), new TripMapper(),
                new TripProperties(RESTORE_WINDOW), CLOCK);
    }

    @Test
    void create_withValidRequest_savesStopsInOrderAndReturnsResponse() {
        knownCities(berlin, prague, vienna);
        when(tripRepository.saveAndFlush(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripResponse response = tripService.create(request("  Notes  ", 1L, 3L, 2L), OWNER_ID);

        ArgumentCaptor<Trip> saved = ArgumentCaptor.forClass(Trip.class);
        verify(tripRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getOwnerId()).isEqualTo(OWNER_ID);
        assertThat(saved.getValue().stopCities()).containsExactly(berlin, prague, vienna);
        assertThat(response.title()).isEqualTo("Weekend in Vienna");
        assertThat(response.stops()).containsExactly(
                new TripStopResponse(1L, "Berlin", "DE", 0),
                new TripStopResponse(3L, "Prague", "CZ", 1),
                new TripStopResponse(2L, "Vienna", "AT", 2));
        assertThat(response.notes()).isEqualTo("Notes");
        assertThat(response.priority()).isEqualTo(TripPriority.GREENEST);
    }

    @Test
    void create_roundTripBackToFirstCity_isAccepted() {
        knownCities(berlin, vienna);
        when(tripRepository.saveAndFlush(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripResponse response = tripService.create(request(null, 1L, 2L, 1L), OWNER_ID);

        assertThat(response.stops()).extracting(TripStopResponse::cityName).containsExactly("Berlin", "Vienna",
                "Berlin");
    }

    @Test
    void create_withBlankNotes_storesNull() {
        knownCities(berlin, vienna);
        when(tripRepository.saveAndFlush(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripResponse response = tripService.create(request("   ", 1L, 2L), OWNER_ID);

        assertThat(response.notes()).isNull();
    }

    @Test
    void create_withDepartureToday_isAccepted() {
        knownCities(berlin, vienna);
        when(tripRepository.saveAndFlush(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripResponse response = tripService.create(requestDeparting(TODAY), OWNER_ID);

        assertThat(response.departureDate()).isEqualTo(TODAY);
    }

    @Test
    void create_withPastDeparture_throwsFieldValidation() {
        assertThatThrownBy(() -> tripService.create(requestDeparting(TODAY.minusDays(1)), OWNER_ID))
                .isInstanceOf(FieldValidationException.class)
                .extracting(ex -> ((FieldValidationException) ex).getErrors())
                .isEqualTo(List.of(new ValidationError("departureDate", "must be today or later")));
        verify(tripRepository, never()).saveAndFlush(any());
    }

    @Test
    void create_withSameCityTwiceInARow_namesTheSecondStop() {
        knownCities(berlin, vienna);

        assertThatThrownBy(() -> tripService.create(request(null, 1L, 2L, 2L), OWNER_ID))
                .isInstanceOf(FieldValidationException.class)
                .extracting(ex -> ((FieldValidationException) ex).getErrors())
                .isEqualTo(List.of(new ValidationError("stops[2].cityId", "must differ from the previous stop")));
        verify(tripRepository, never()).saveAndFlush(any());
    }

    @Test
    void create_withSeveralBadStops_reportsEachOne() {
        knownCities(berlin);

        assertThatThrownBy(() -> tripService.create(request(null, 99L, 1L, 1L, 98L), OWNER_ID))
                .isInstanceOf(FieldValidationException.class)
                .extracting(ex -> ((FieldValidationException) ex).getErrors())
                .isEqualTo(List.of(
                        new ValidationError("stops[0].cityId", "unknown city id 99"),
                        new ValidationError("stops[2].cityId", "must differ from the previous stop"),
                        new ValidationError("stops[3].cityId", "unknown city id 98")));
        verify(tripRepository, never()).saveAndFlush(any());
    }

    @Test
    void findById_whenMissing_throwsNotFound() {
        when(tripRepository.findActiveByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.findById(42L, OWNER_ID))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Trip with id 42 not found");
    }

    @Test
    void update_replacesFieldsAndTheWholeStopList() {
        Trip existing = trip(5L, "Old title");
        knownCities(berlin, prague, vienna);
        when(tripRepository.findActiveByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(existing));
        when(tripRepository.saveAndFlush(existing)).thenReturn(existing);

        TripRequest longer = new TripRequest("Loop", stops(2L, 3L, 1L), DEPARTURE, 3, TripPriority.CHEAPEST, null);
        TripResponse response = tripService.update(5L, longer, OWNER_ID);

        assertThat(response.id()).isEqualTo(5L);
        assertThat(response.title()).isEqualTo("Loop");
        assertThat(response.stops()).extracting(TripStopResponse::cityName, TripStopResponse::position)
                .containsExactly(tuple("Vienna", 0),
                        tuple("Prague", 1),
                        tuple("Berlin", 2));
        assertThat(response.travelers()).isEqualTo(3);
        assertThat(response.priority()).isEqualTo(TripPriority.CHEAPEST);
    }

    @Test
    void update_withFewerStops_removesTheSurplusOnes() {
        Trip existing = trip(5L, "Loop");
        existing.replaceStops(List.of(berlin, prague, vienna));
        knownCities(berlin, vienna);
        when(tripRepository.findActiveByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(existing));
        when(tripRepository.saveAndFlush(existing)).thenReturn(existing);

        tripService.update(5L, request(null, 2L, 1L), OWNER_ID);

        assertThat(existing.stopCities()).containsExactly(vienna, berlin);
        assertThat(existing.getStops()).extracting("position").containsExactly(0, 1);
    }

    @Test
    void update_pastTripWithUnchangedDate_isAccepted() {
        Trip pastTrip = trip(5L, "Last summer");
        pastTrip.setDepartureDate(TODAY.minusMonths(3));
        knownCities(berlin, vienna);
        when(tripRepository.findActiveByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(pastTrip));
        when(tripRepository.saveAndFlush(pastTrip)).thenReturn(pastTrip);

        TripResponse response = tripService.update(5L, requestDeparting(TODAY.minusMonths(3)), OWNER_ID);

        assertThat(response.title()).isEqualTo("Weekend in Vienna");
        assertThat(response.departureDate()).isEqualTo(TODAY.minusMonths(3));
    }

    @Test
    void update_movingDepartureIntoPast_throwsFieldValidation() {
        when(tripRepository.findActiveByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(trip(5L, "Upcoming")));

        assertThatThrownBy(() -> tripService.update(5L, requestDeparting(TODAY.minusDays(1)), OWNER_ID))
                .isInstanceOf(FieldValidationException.class)
                .extracting(ex -> ((FieldValidationException) ex).getErrors().getFirst().field())
                .isEqualTo("departureDate");
        verify(tripRepository, never()).saveAndFlush(any());
    }

    @Test
    void update_whenMissing_throwsNotFound() {
        when(tripRepository.findActiveByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.update(42L, request(null, 1L, 2L), OWNER_ID))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void delete_existingTrip_marksItDeletedNow() {
        Trip existing = trip(5L, "To delete");
        when(tripRepository.findActiveByIdAndOwnerId(5L, OWNER_ID))
                .thenReturn(Optional.of(existing));

        tripService.delete(5L, OWNER_ID);

        assertThat(existing.getDeletedAt()).isEqualTo(CLOCK.instant());
        verify(tripRepository, never()).delete(any(Trip.class));
    }

    @Test
    void delete_whenMissingDeletedOrSomeoneElses_throwsNotFound() {
        when(tripRepository.findActiveByIdAndOwnerId(42L, OWNER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.delete(42L, OWNER_ID)).isInstanceOf(ResourceNotFoundException.class);
        verify(tripRepository, never()).delete(any(Trip.class));
    }

    @Test
    void restore_insideTheWindow_clearsDeletedAt() {
        Trip deleted = trip(5L, "Deleted");
        deleted.markDeleted(CLOCK.instant().minusSeconds(10));
        when(tripRepository.findWithStopsByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(deleted));
        when(tripRepository.saveAndFlush(deleted)).thenReturn(deleted);

        TripResponse response = tripService.restore(5L, OWNER_ID);

        assertThat(deleted.isDeleted()).isFalse();
        assertThat(response.id()).isEqualTo(5L);
    }

    @Test
    void restore_exactlyAtTheEndOfTheWindow_isStillAllowed() {
        Trip deleted = trip(5L, "Deleted");
        deleted.markDeleted(CLOCK.instant().minus(RESTORE_WINDOW));
        when(tripRepository.findWithStopsByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(deleted));
        when(tripRepository.saveAndFlush(deleted)).thenReturn(deleted);

        tripService.restore(5L, OWNER_ID);

        assertThat(deleted.isDeleted()).isFalse();
    }

    @Test
    void restore_afterTheWindow_throwsConflictAndStaysDeleted() {
        Trip deleted = trip(5L, "Deleted");
        deleted.markDeleted(CLOCK.instant().minus(RESTORE_WINDOW).minusMillis(1));
        when(tripRepository.findWithStopsByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(deleted));

        assertThatThrownBy(() -> tripService.restore(5L, OWNER_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("30 s");
        assertThat(deleted.isDeleted()).isTrue();
        verify(tripRepository, never()).saveAndFlush(any());
    }

    @Test
    void restore_activeTrip_returnsItUnchanged() {
        Trip active = trip(5L, "Active");
        when(tripRepository.findWithStopsByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(active));

        TripResponse response = tripService.restore(5L, OWNER_ID);

        assertThat(response.title()).isEqualTo("Active");
        verify(tripRepository, never()).saveAndFlush(any());
    }

    @Test
    void restore_unknownOrSomeoneElsesTrip_throwsNotFound() {
        when(tripRepository.findWithStopsByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.restore(42L, OWNER_ID)).isInstanceOf(ResourceNotFoundException.class);
    }

    private void knownCities(City... cities) {
        when(cityRepository.findAllById(anyIterable())).thenReturn(Arrays.asList(cities));
    }

    private static List<TripStopRequest> stops(Long... cityIds) {
        return Arrays.stream(cityIds).map(TripStopRequest::new).toList();
    }

    private static TripRequest request(String notes, Long... cityIds) {
        return new TripRequest("  Weekend in Vienna ", stops(cityIds), DEPARTURE, 2, TripPriority.GREENEST, notes);
    }

    private static TripRequest requestDeparting(LocalDate departureDate) {
        return new TripRequest("Weekend in Vienna", stops(1L, 2L), departureDate, 2, TripPriority.GREENEST, null);
    }

    private Trip trip(Long id, String title) {
        Trip trip = new Trip();
        trip.setId(id);
        trip.setTitle(title);
        trip.replaceStops(List.of(berlin, vienna));
        trip.setDepartureDate(DEPARTURE);
        trip.setTravelers(1);
        trip.setPriority(TripPriority.BALANCED);
        trip.setOwnerId(OWNER_ID);
        return trip;
    }
}
