package com.routewise;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

import jakarta.persistence.Entity;

import org.springframework.web.bind.annotation.RestController;

/**
 * The layering from CLAUDE.md as executable rules: controller → service → repository,
 * and controllers exchange DTOs only.
 */
@AnalyzeClasses(packages = "com.routewise", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule controllersDoNotUseRepositories = noClasses()
            .that().resideInAPackage("..controller..")
            .should().dependOnClassesThat().resideInAPackage("..repository..")
            .because("controllers go through services");

    @ArchTest
    static final ArchRule servicesDoNotDependOnControllers = noClasses()
            .that().resideInAPackage("..service..")
            .should().dependOnClassesThat().resideInAPackage("..controller..")
            .because("services must not know the web layer");

    @ArchTest
    static final ArchRule repositoriesDependOnNoUpperLayer = noClasses()
            .that().resideInAPackage("..repository..")
            .should().dependOnClassesThat().resideInAnyPackage("..service..", "..controller..")
            .because("repositories are the bottom layer");

    @ArchTest
    static final ArchRule controllerSignaturesUseNoEntities = methods()
            .that().areDeclaredInClassesThat().areAnnotatedWith(RestController.class)
            .and().arePublic()
            .should(notExposeEntities())
            .because("controllers exchange DTOs, entities never leave the service layer");

    /** No {@code @Entity} as return type, parameter type or a type argument of either. */
    private static ArchCondition<JavaMethod> notExposeEntities() {
        DescribedPredicate<JavaClass> entity = DescribedPredicate.describe("an @Entity",
                type -> type.isAnnotatedWith(Entity.class));
        return new ArchCondition<>("not use @Entity types in their signature") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                boolean exposes = method.getReturnType().getAllInvolvedRawTypes().stream().anyMatch(entity)
                        || method.getParameterTypes().stream()
                                .flatMap(type -> type.getAllInvolvedRawTypes().stream())
                                .anyMatch(entity);
                if (exposes && !method.getModifiers().contains(JavaModifier.SYNTHETIC)) {
                    events.add(SimpleConditionEvent.violated(method,
                            method.getFullName() + " uses an @Entity in its signature"));
                }
            }
        };
    }
}
