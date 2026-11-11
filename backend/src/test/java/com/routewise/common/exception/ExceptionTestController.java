package com.routewise.common.exception;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only controller that triggers each error path of {@link GlobalExceptionHandler}.
 */
@RestController
@RequestMapping("/api/test")
class ExceptionTestController {

    static class ConflictException extends RouteWiseException {

        ConflictException(String message) {
            super(HttpStatus.CONFLICT, message);
        }
    }

    record TestRequest(@NotBlank String title, @Min(1) int travelers) {
    }

    @GetMapping("/items/{id}")
    String notFound(@PathVariable long id) {
        throw new ResourceNotFoundException("Item", id);
    }

    @PostMapping("/items")
    TestRequest create(@Valid @RequestBody TestRequest request) {
        return request;
    }

    @GetMapping("/search")
    String search(@RequestParam @Min(1) int page) {
        return "page " + page;
    }

    @GetMapping("/conflict")
    String conflict() {
        throw new ConflictException("Item already exists");
    }

    @GetMapping("/failure")
    String failure() {
        throw new IllegalStateException("database password is hunter2");
    }
}
