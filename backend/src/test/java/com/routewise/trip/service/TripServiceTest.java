package com.routewise.trip.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import com.routewise.city.TestCities;
import com.routewise.city.domain.City;
import com.routewise.city.mapper.CityMapper;
import com.routewise.city.repository.CityRepository;
import com.routewise.common.exception.FieldValidationException;
import com.routewise.common.exception.ResourceNotFoundException;
import com.routewise.common.exception.ValidationError;
import com.routewise.trip.domain.Trip;
import com.routewise.trip.domain.TripPriority;
import com.routewise.trip.dto.TripRequest;
import com.routewise.trip.dto.TripResponse;
import com.routewise.trip.mapper.TripMapper;
import com.routewise.trip.repository.TripRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TripServiceTest {

    private static final long OWNER_ID = 7L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 11);
    private static final LocalDate DEPARTURE = TODAY.plusDays(7);
    private static final Clock CLOCK = Clock.fixed(TODAY.atStartOfDay().toInstant(ZoneOffset.UTC), ZoneOffset.UTC);

    @Mock
    private TripRepository tripRepository;

    @Mock
    private CityRepository cityRepository;

    private TripService tripService;

    private final City berlin = TestCities.berlin();
    private final City vienna = TestCities.vienna();

    @BeforeEach
    void setUp() {
        tripService = new TripService(tripRepository, cityRepository, new TripMapper(new CityMapper()), CLOCK);
    }

    @Test
    void create_withValidRequest_savesTripAndReturnsResponse() {
        when(cityRepository.findById(1L)).thenReturn(Optional.of(berlin));
        when(cityRepository.findById(2L)).thenReturn(Optional.of(vienna));
        when(tripRepository.saveAndFlush(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripResponse response = tripService.create(request(1L, 2L, "  Notes  "), OWNER_ID);

        ArgumentCaptor<Trip> saved = ArgumentCaptor.forClass(Trip.class);
        verify(tripRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getOwnerId()).isEqualTo(OWNER_ID);
        assertThat(saved.getValue().getOrigin()).isSameAs(berlin);
        assertThat(saved.getValue().getDestination()).isSameAs(vienna);
        assertThat(response.title()).isEqualTo("Weekend in Vienna");
        assertThat(response.origin().name()).isEqualTo("Berlin");
        assertThat(response.destination().country()).isEqualTo("AT");
        assertThat(response.notes()).isEqualTo("Notes");
        assertThat(response.priority()).isEqualTo(TripPriority.GREENEST);
    }

    @Test
    void create_withBlankNotes_storesNull() {
        when(cityRepository.findById(1L)).thenReturn(Optional.of(berlin));
        when(cityRepository.findById(2L)).thenReturn(Optional.of(vienna));
        when(tripRepository.saveAndFlush(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripResponse response = tripService.create(request(1L, 2L, "   "), OWNER_ID);

        assertThat(response.notes()).isNull();
    }

    @Test
    void create_withDepartureToday_isAccepted() {
        when(cityRepository.findById(1L)).thenReturn(Optional.of(berlin));
        when(cityRepository.findById(2L)).thenReturn(Optional.of(vienna));
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
    void create_withSameOriginAndDestination_throwsFieldValidation() {
        assertThatThrownBy(() -> tripService.create(request(1L, 1L, null), OWNER_ID))
                .isInstanceOf(FieldValidationException.class)
                .extracting(ex -> ((FieldValidationException) ex).getErrors())
                .isEqualTo(List.of(new ValidationError("destinationCityId", "must differ from originCityId")));
        verify(tripRepository, never()).saveAndFlush(any());
    }

    @Test
    void create_withUnknownOrigin_throwsFieldValidation() {
        when(cityRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.create(request(99L, 2L, null), OWNER_ID))
                .isInstanceOf(FieldValidationException.class)
                .extracting(ex -> ((FieldValidationException) ex).getErrors().getFirst().field())
                .isEqualTo("originCityId");
        verify(tripRepository, never()).saveAndFlush(any());
    }

    @Test
    void findById_whenMissing_throwsNotFound() {
        when(tripRepository.findWithCitiesByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.findById(42L, OWNER_ID))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Trip with id 42 not found");
    }

    @Test
    void findAll_mapsTripsInRepositoryOrder() {
        Trip first = trip(1L, "First");
        Trip second = trip(2L, "Second");
        when(tripRepository.findAllByOwnerIdOrderByDepartureDateAscIdAsc(OWNER_ID)).thenReturn(List.of(first, second));

        assertThat(tripService.findAll(OWNER_ID)).extracting(TripResponse::title).containsExactly("First", "Second");
    }

    @Test
    void update_existingTrip_replacesFields() {
        Trip existing = trip(5L, "Old title");
        when(tripRepository.findWithCitiesByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(existing));
        when(cityRepository.findById(2L)).thenReturn(Optional.of(vienna));
        when(cityRepository.findById(1L)).thenReturn(Optional.of(berlin));
        when(tripRepository.saveAndFlush(existing)).thenReturn(existing);

        TripRequest swapped = new TripRequest("Back home", 2L, 1L, DEPARTURE, 3, TripPriority.CHEAPEST, null);
        TripResponse response = tripService.update(5L, swapped, OWNER_ID);

        assertThat(response.id()).isEqualTo(5L);
        assertThat(response.title()).isEqualTo("Back home");
        assertThat(response.origin().name()).isEqualTo("Vienna");
        assertThat(response.destination().name()).isEqualTo("Berlin");
        assertThat(response.travelers()).isEqualTo(3);
        assertThat(response.priority()).isEqualTo(TripPriority.CHEAPEST);
    }

    @Test
    void update_pastTripWithUnchangedDate_isAccepted() {
        Trip pastTrip = trip(5L, "Last summer");
        pastTrip.setDepartureDate(TODAY.minusMonths(3));
        when(tripRepository.findWithCitiesByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(pastTrip));
        when(cityRepository.findById(1L)).thenReturn(Optional.of(berlin));
        when(cityRepository.findById(2L)).thenReturn(Optional.of(vienna));
        when(tripRepository.saveAndFlush(pastTrip)).thenReturn(pastTrip);

        TripResponse response = tripService.update(5L, requestDeparting(TODAY.minusMonths(3)), OWNER_ID);

        assertThat(response.title()).isEqualTo("Weekend in Vienna");
        assertThat(response.departureDate()).isEqualTo(TODAY.minusMonths(3));
    }

    @Test
    void update_movingDepartureIntoPast_throwsFieldValidation() {
        when(tripRepository.findWithCitiesByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(trip(5L, "Upcoming")));

        assertThatThrownBy(() -> tripService.update(5L, requestDeparting(TODAY.minusDays(1)), OWNER_ID))
                .isInstanceOf(FieldValidationException.class)
                .extracting(ex -> ((FieldValidationException) ex).getErrors().getFirst().field())
                .isEqualTo("departureDate");
        verify(tripRepository, never()).saveAndFlush(any());
    }

    @Test
    void update_whenMissing_throwsNotFound() {
        when(tripRepository.findWithCitiesByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.update(42L, request(1L, 2L, null), OWNER_ID))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void delete_existingTrip_deletesIt() {
        Trip existing = trip(5L, "To delete");
        when(tripRepository.findWithCitiesByIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.of(existing));

        tripService.delete(5L, OWNER_ID);

        verify(tripRepository).delete(existing);
    }

    @Test
    void delete_whenMissing_throwsNotFound() {
        when(tripRepository.findWithCitiesByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tripService.delete(42L, OWNER_ID)).isInstanceOf(ResourceNotFoundException.class);
        verify(tripRepository, never()).delete(any());
    }

    private static TripRequest request(Long originId, Long destinationId, String notes) {
        return new TripRequest("  Weekend in Vienna ", originId, destinationId, DEPARTURE, 2,
                TripPriority.GREENEST, notes);
    }

    private static TripRequest requestDeparting(LocalDate departureDate) {
        return new TripRequest("Weekend in Vienna", 1L, 2L, departureDate, 2,
                TripPriority.GREENEST, null);
    }

    private Trip trip(Long id, String title) {
        Trip trip = new Trip();
        trip.setId(id);
        trip.setTitle(title);
        trip.setOrigin(berlin);
        trip.setDestination(vienna);
        trip.setDepartureDate(DEPARTURE);
        trip.setTravelers(1);
        trip.setPriority(TripPriority.BALANCED);
        trip.setOwnerId(OWNER_ID);
        return trip;
    }
}
