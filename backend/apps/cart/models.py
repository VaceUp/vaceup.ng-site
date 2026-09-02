"""Shopping cart for course purchases."""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.courses.models import Course


class Cart(TimeStampedModel):
    """User's shopping cart - one per user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart",
    )

    class Meta:
        verbose_name = "Cart"
        verbose_name_plural = "Carts"

    def __str__(self):
        return f"Cart for {self.user.email}"

    @property
    def item_count(self):
        return self.items.count()

    @property
    def subtotal(self):
        return sum(item.subtotal for item in self.items.all())

    @property
    def total(self):
        return self.subtotal  # Tax/discounts handled in checkout


class CartItem(TimeStampedModel):
    """A single course in a user's cart."""

    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items",
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="cart_items",
    )
    # Optional price override for discounts/promos
    price_override = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "course"], name="uq_cart_course"
            )
        ]

    def __str__(self):
        return f"{self.course.title} in cart"

    @property
    def effective_price(self):
        return self.price_override if self.price_override is not None else self.course.price

    @property
    def subtotal(self):
        return self.effective_price