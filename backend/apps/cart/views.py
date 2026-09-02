"""Shopping cart endpoints."""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.cart.models import Cart, CartItem
from apps.cart.serializers import (
    CartSerializer,
    CartItemSerializer,
    CartItemCreateSerializer,
)


class CartViewSet(viewsets.GenericViewSet):
    """Cart management for authenticated students."""

    permission_classes = [IsAuthenticated]
    serializer_class = CartSerializer

    def get_queryset(self):
        return Cart.objects.filter(user=self.request.user)

    def get_object(self):
        cart, _ = Cart.objects.get_or_create(user=self.request.user)
        return cart

    def list(self, request):
        """GET /cart/ - view cart contents."""
        cart = self.get_object()
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    def create(self, request):
        """POST /cart/items/ - add course to cart."""
        serializer = CartItemCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(
            CartItemSerializer(item).data, status=status.HTTP_201_CREATED
        )

    def destroy(self, request, pk=None):
        """DELETE /cart/items/{id}/ - remove item from cart."""
        cart = self.get_object()
        item = CartItem.objects.filter(cart=cart, pk=pk).first()
        if not item:
            return Response(
                {"detail": "Item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def partial_update(self, request, pk=None):
        """PATCH /cart/items/{id}/ - update quantity/price (future: quantity support)."""
        cart = self.get_object()
        item = CartItem.objects.filter(cart=cart, pk=pk).first()
        if not item:
            return Response(
                {"detail": "Item not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        # Currently only price_override is editable
        serializer = CartItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["delete"], url_path="clear")
    def clear(self, request):
        """DELETE /cart/ - clear all items."""
        cart = self.get_object()
        cart.items.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)