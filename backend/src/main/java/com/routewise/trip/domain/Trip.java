package com.routewise.trip.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import com.routewise.city.domain.City;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "trip")
@Getter
@Setter
@NoArgsConstructor
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    /** The ordered stops (2-10); change them only through {@link #replaceStops}. */
    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    @Setter(AccessLevel.NONE)
    private List<TripStop> stops = new ArrayList<>();

    @Column(name = "departure_date", nullable = false)
    private LocalDate departureDate;

    @Column(nullable = false)
    private int travelers;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TripPriority priority;

    @Column(length = 1000)
    private String notes;

    /** The account the trip belongs to; trips are private to their owner. */
    @Column(name = "owner_id", nullable = false, updatable = false)
    private Long ownerId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * Sets the ordered stops. Existing stop rows are reused position by position
     * (only their city changes), extra ones are added and surplus ones removed,
     * so the unique (trip, position) constraint never sees two rows at one position.
     */
    public void replaceStops(List<City> cities) {
        for (int position = 0; position < cities.size(); position++) {
            if (position < stops.size()) {
                stops.get(position).setCity(cities.get(position));
            } else {
                TripStop stop = new TripStop();
                stop.setTrip(this);
                stop.setCity(cities.get(position));
                stop.setPosition(position);
                stops.add(stop);
            }
        }
        while (stops.size() > cities.size()) {
            stops.removeLast();
        }
    }

    /** The stops' cities in order. */
    public List<City> stopCities() {
        return stops.stream().map(TripStop::getCity).toList();
    }
}
